import { getServerClient } from '@/lib/db/server';
import { requireSession } from '@/lib/api/guards';
import { internal, ok } from '@/lib/api/respond';
import { simulatedAdapter } from '@/lib/adapters/simulated';
import { csvAdapter } from '@/lib/adapters/csv';

export async function GET() {
  const guard = await requireSession();
  if ('response' in guard) return guard.response;

  try {
    const supabase = await getServerClient();
    const { data } = await supabase
      .from('aggregator_connections').select('*')
      .eq('firm_id', guard.session.profile.firm_id);

    return ok({
      connections: (data ?? []).map((c) => ({
        vendor: c.vendor, status: c.status,
        lastSyncAt: c.last_sync_at, lastError: c.last_error,
      })),
      // Surfaced so the UI can render the release path as inert because no adapter claims the
      // capability, rather than because a flag happens to be off (contract §3).
      capabilities: {
        csv: csvAdapter.capabilities,
        simulated: simulatedAdapter.capabilities,
        byallaccounts: {
          holdings: true, transactions: true, taxLots: true,
          lotLevelBasis: true, orderRouting: false,
        },
      },
    });
  } catch (error) {
    return internal(error);
  }
}
