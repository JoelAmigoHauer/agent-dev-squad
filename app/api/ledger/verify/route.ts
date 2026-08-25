import { requireSession } from '@/lib/api/guards';
import { verifyChain } from '@/lib/ledger';
import { internal, ok } from '@/lib/api/respond';

/** Returns 200 on a broken chain too. A tamper report is a successful verification reporting a
 *  true fact; a 500 here would make the most important thing this system can say look like an
 *  outage. Contract §3. */
export async function GET() {
  const guard = await requireSession();
  if ('response' in guard) return guard.response;

  try {
    return ok(await verifyChain(guard.session.profile.firm_id));
  } catch (error) {
    return internal(error);
  }
}
