import { getServiceClient, getServerClient } from '@/lib/db/server';
import { requireWriter } from '@/lib/api/guards';
import { parseExtract } from '@/lib/adapters/csv';
import { ingestSnapshot, StaleExtractError } from '@/lib/api/ingest';
import { appendLedger } from '@/lib/ledger';
import { conflict, internal, notFound, ok, unprocessable } from '@/lib/api/respond';

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: Request) {
  const guard = await requireWriter();
  if ('response' in guard) return guard.response;
  const { session } = guard;

  try {
    const form = await req.formData().catch(() => null);
    if (!form) return unprocessable('expected_multipart');

    const householdId = String(form.get('householdId') ?? '');
    const file = form.get('file');
    if (!householdId) return unprocessable('validation', 'householdId');
    if (!(file instanceof File)) return unprocessable('validation', 'file');
    if (file.size > MAX_BYTES) return unprocessable('file_too_large', 'file', { maxBytes: MAX_BYTES });

    const supabase = await getServerClient();
    const { data: household } = await supabase
      .from('households').select('id, name').eq('id', householdId).maybeSingle();
    if (!household) return notFound('household_not_found');

    let parsed;
    try {
      parsed = parseExtract(await file.text());
    } catch (error) {
      return unprocessable('unparseable', undefined, {
        line: error instanceof SyntaxError ? 1 : null,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    const service = getServiceClient();
    let result;
    try {
      result = await ingestSnapshot(
        service,
        { firmId: session.profile.firm_id, householdId, custodian: 'csv' },
        parsed.snapshot,
        parsed.quarantined,
      );
    } catch (error) {
      if (error instanceof StaleExtractError) {
        return conflict('stale_extract', {
          extractAsOf: error.extractAsOf, currentAsOf: error.currentAsOf,
        });
      }
      throw error;
    }

    await appendLedger({
      firmId: session.profile.firm_id,
      actor: { type: 'advisor', advisorId: session.userId },
      eventType: 'custodian.imported',
      householdId, subjectType: 'import', subjectId: null,
      payload: {
        adapter: 'csv', fileName: file.name, fileBytes: file.size,
        accounts: result.accounts, positions: result.positions,
        taxLots: result.taxLots, transactions: result.transactions,
        quarantined: result.quarantined.length,
      },
      dataSources: [{ type: 'csv_upload', fileName: file.name, asOf: result.asOf }],
    });

    return ok(result);
  } catch (error) {
    return internal(error);
  }
}
