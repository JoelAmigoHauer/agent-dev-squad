import { z } from 'zod';
import { getServerClient, getServiceClient } from '@/lib/db/server';
import { requirePrincipal } from '@/lib/api/guards';
import { appendLedger } from '@/lib/ledger';
import { conflict, internal, ok, unprocessable } from '@/lib/api/respond';

const bodySchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(200),
  role: z.enum(['advisor', 'readonly']),
});

export async function POST(req: Request) {
  const guard = await requirePrincipal();
  if ('response' in guard) return guard.response;
  const { session } = guard;

  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return unprocessable('validation', issue?.path.join('.'), issue?.message);
    }
    const { email, fullName, role } = parsed.data;

    const supabase = await getServerClient();
    const { data: existing } = await supabase
      .from('advisor_profiles').select('id')
      .eq('firm_id', session.profile.firm_id).ilike('email', email).maybeSingle();
    if (existing) return conflict('already_member');

    // Invite, never create-with-password. A principal must not be able to set another advisor's
    // credential — the invited person owns their own authentication.
    const service = getServiceClient();
    const { data: invited, error: inviteError } =
      await service.auth.admin.inviteUserByEmail(email);
    if (inviteError || !invited.user) return internal(inviteError);

    const { data: profile, error } = await service
      .from('advisor_profiles')
      .insert({
        id: invited.user.id, firm_id: session.profile.firm_id,
        full_name: fullName, email, role,
      })
      .select('*').single();
    if (error) return internal(error);

    await appendLedger({
      firmId: session.profile.firm_id,
      actor: { type: 'advisor', advisorId: session.userId },
      eventType: 'advisor.invited',
      subjectType: 'advisor_profile', subjectId: profile.id,
      payload: { email, fullName, role },
    });

    return ok({ advisor: profile });
  } catch (error) {
    return internal(error);
  }
}
