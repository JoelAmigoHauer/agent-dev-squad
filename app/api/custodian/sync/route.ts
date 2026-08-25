import { z } from 'zod';
import { getServerClient, getServiceClient } from '@/lib/db/server';
import { requireWriter } from '@/lib/api/guards';
import { simulatedAdapter } from '@/lib/adapters/simulated';
import { createByAllAccountsAdapter } from '@/lib/adapters/byallaccounts';
import { NotConnectedError, VendorUnavailableError, type CustodianAdapter } from '@/lib/adapters/custodian';
import { ingestSnapshot, StaleExtractError } from '@/lib/api/ingest';
import { simulatedMarketData } from '@/lib/adapters/marketdata';
import { appendLedger } from '@/lib/ledger';
import { conflict, internal, notFound, ok, unprocessable } from '@/lib/api/respond';
import { NextResponse } from 'next/server';

const bodySchema = z.object({
  householdId: z.string().uuid(),
  vendor: z.enum(['byallaccounts', 'simulated']),
});

export async function POST(req: Request) {
  const guard = await requireWriter();
  if ('response' in guard) return guard.response;
  const { session } = guard;

  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return unprocessable('validation', issue?.path.join('.'), issue?.message);
    }
    const { householdId, vendor } = parsed.data;

    const supabase = await getServerClient();
    const { data: household } = await supabase
      .from('households').select('id').eq('id', householdId).maybeSingle();
    if (!household) return notFound('household_not_found');

    const service = getServiceClient();
    const { data: connection } = await supabase
      .from('aggregator_connections').select('*')
      .eq('firm_id', session.profile.firm_id).eq('vendor', vendor).maybeSingle();

    let adapter: CustodianAdapter;
    if (vendor === 'simulated') {
      adapter = simulatedAdapter;
    } else {
      if (!connection || connection.status !== 'connected') {
        return conflict('not_connected', { vendor, status: connection?.status ?? 'pending' });
      }
      adapter = createByAllAccountsAdapter(connection.external_id);
    }

    let snapshot;
    try {
      snapshot = await adapter.fetchSnapshot({ firmId: session.profile.firm_id, householdId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (connection) {
        await service.from('aggregator_connections')
          .update({ status: 'error', last_error: message }).eq('id', connection.id);
      }
      if (error instanceof NotConnectedError) {
        return conflict('not_connected', { vendor, status: error.status });
      }
      if (error instanceof VendorUnavailableError) {
        // 502, not 500: the failure is upstream, and an advisor reading "internal error" would
        // open a support ticket against us for the vendor's outage.
        return NextResponse.json(
          { error: 'vendor_unavailable', detail: { vendor, upstreamStatus: error.upstreamStatus } },
          { status: 502 },
        );
      }
      throw error;
    }

    let result;
    try {
      result = await ingestSnapshot(
        service, { firmId: session.profile.firm_id, householdId, custodian: vendor }, snapshot,
      );
    } catch (error) {
      if (error instanceof StaleExtractError) {
        return conflict('stale_extract', {
          extractAsOf: error.extractAsOf, currentAsOf: error.currentAsOf,
        });
      }
      throw error;
    }

    // Prices come from the market-data adapter, separately from holdings — A2's polled snapshots.
    const symbols = [...new Set(snapshot.positions.map((p) => p.symbol))];
    if (symbols.length) {
      const quotes = await simulatedMarketData.fetchPrices(symbols);
      if (quotes.length) {
        const { data: securities } = await service
          .from('securities').select('id, symbol').in('symbol', quotes.map((q) => q.symbol));
        const idBySymbol = new Map((securities ?? []).map((s) => [s.symbol, s.id]));
        const rows = quotes.flatMap((q) => {
          const securityId = idBySymbol.get(q.symbol);
          return securityId
            ? [{ security_id: securityId, price_date: q.priceDate,
                 close_price: q.closePrice, source: q.source }]
            : [];
        });
        if (rows.length) {
          await service.from('security_prices')
            .upsert(rows, { onConflict: 'security_id,price_date' });
        }
      }
    }

    if (connection) {
      await service.from('aggregator_connections')
        .update({ status: 'connected', last_sync_at: new Date().toISOString(), last_error: null })
        .eq('id', connection.id);
    }

    await appendLedger({
      firmId: session.profile.firm_id,
      actor: { type: 'advisor', advisorId: session.userId },
      eventType: 'custodian.synced',
      householdId, subjectType: 'sync', subjectId: null,
      payload: {
        vendor, accounts: result.accounts, positions: result.positions,
        taxLots: result.taxLots, transactions: result.transactions,
        lotLevelBasis: adapter.capabilities.lotLevelBasis,
      },
      dataSources: [{ type: 'aggregator', vendor, asOf: result.asOf }],
    });

    return ok({ syncId: `${vendor}:${result.asOf}`, status: 'running', ...result }, 202);
  } catch (error) {
    return internal(error);
  }
}
