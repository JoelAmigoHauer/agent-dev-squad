import { z } from 'zod';
import { getServerClient } from '@/lib/db/server';
import { requirePrincipal } from '@/lib/api/guards';
import { appendLedger } from '@/lib/ledger';
import { internal, ok, unprocessable } from '@/lib/api/respond';

const bodySchema = z.object({
  shadowMode: z.boolean().optional(),
  name: z.string().min(1).max(200).optional(),
});

export async function PATCH(req: Request) {
  const guard = await requirePrincipal();
  if ('response' in guard) return guard.response;
  const { session } = guard;

  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return unprocessable('validation');

    const supabase = await getServerClient();
    const { data: firm, error } = await supabase
      .from('firms')
      .update({
        ...(parsed.data.shadowMode !== undefined && { shadow_mode: parsed.data.shadowMode }),
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      })
      .eq('id', session.profile.firm_id)
      .select('*').single();
    if (error) return internal(error);

    // Turning shadow mode off is the single most consequential setting change in the product.
    // It gets its own ledger event so it is never buried inside a generic "settings updated".
    if (parsed.data.shadowMode !== undefined
        && parsed.data.shadowMode !== session.firm.shadow_mode) {
      await appendLedger({
        firmId: session.profile.firm_id,
        actor: { type: 'advisor', advisorId: session.userId },
        eventType: parsed.data.shadowMode ? 'shadow_mode.enabled' : 'shadow_mode.disabled',
        subjectType: 'firm', subjectId: session.profile.firm_id,
        payload: { from: session.firm.shadow_mode, to: parsed.data.shadowMode },
      });
    }

    return ok({ firm });
  } catch (error) {
    return internal(error);
  }
}
