import { getServerClient } from '@/lib/db/server';
import type { AdvisorSession } from '@/lib/db/session';
import type { Tables } from '@/lib/db/database.types';
import { conflict, notFound } from '@/lib/api/respond';
import type { NextResponse } from 'next/server';

/**
 * The shared precondition check for approve, reject and modify.
 *
 * One place, because three routes each re-implementing "is this still decidable" is how one of
 * them ends up missing the expiry check — and the one that misses it is the one that lets an
 * advisor approve a day-old proposal against prices that have moved.
 */
export async function loadDecidable(
  id: string,
  _session: AdvisorSession,
  opts: { requireFresh?: boolean } = {},
): Promise<{ recommendation: Tables<'recommendations'> } | { response: NextResponse }> {
  const supabase = await getServerClient();
  const { data: recommendation } = await supabase
    .from('recommendations').select('*').eq('id', id).maybeSingle();

  if (!recommendation) return { response: notFound('recommendation_not_found') };

  if (recommendation.status !== 'pending') {
    return {
      response: conflict('already_decided', {
        status: recommendation.status,
        decidedAt: recommendation.decided_at,
        decidedBy: recommendation.decided_by,
      }),
    };
  }

  if (new Date(recommendation.expires_at).getTime() <= Date.now()) {
    return { response: conflict('expired', { expiresAt: recommendation.expires_at }) };
  }

  // Rejecting a stale recommendation is always allowed — refusing it would leave the advisor
  // unable to clear a proposal the system itself says it no longer trusts.
  if (opts.requireFresh && recommendation.stale_data) {
    const provenance = recommendation.provenance as { pricesAsOf?: string } | null;
    return { response: conflict('stale_data', { pricesAsOf: provenance?.pricesAsOf ?? null }) };
  }

  return { recommendation };
}
