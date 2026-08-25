import { getServerClient } from '@/lib/db/server';
import { requireSession, isUuid } from '@/lib/api/guards';
import { internal, notFound, ok } from '@/lib/api/respond';
import { loadHouseholdFacts } from '@/lib/api/household-facts';
import { computeDrift } from '@/lib/domain/drift';
import { ZERO, add, toDb } from '@/lib/domain/money';

/** Recomputed on read, never cached — contract §3. A cached drift number that disagrees with the
 *  positions it came from is exactly the failure this endpoint exists to prevent. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if ('response' in guard) return guard.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();

  try {
    const supabase = await getServerClient();
    const facts = await loadHouseholdFacts(supabase, id);
    if (!facts) return notFound('household_not_found');
    if (!facts.mandate) return ok({ asOf: facts.asOf, totalMarketValue: '0', bands: [] });

    const report = computeDrift(
      facts.ctx.positions.map((p) => ({
        assetClass: facts.ctx.securities.find((s) => s.id === p.securityId)?.assetClass ?? 'other',
        marketValue: p.marketValue,
      })),
      facts.ctx.mandate.bands,
      add(...facts.ctx.accounts.map((a) => a.cashBalance), ZERO),
    );

    return ok({
      asOf: facts.asOf,
      totalMarketValue: toDb(report.totalMarketValue).toFixed(2),
      worstDriftBps: report.worstDriftBps,
      anyBreached: report.anyBreached,
      bands: report.bands.map((b) => ({
        assetClass: b.assetClass, targetBps: b.targetBps, minBps: b.minBps, maxBps: b.maxBps,
        actualBps: b.actualBps, driftBps: b.driftBps, breached: b.breached,
        marketValue: toDb(b.marketValue).toFixed(2),
      })),
    });
  } catch (error) {
    return internal(error);
  }
}
