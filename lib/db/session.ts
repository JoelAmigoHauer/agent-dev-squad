import { getServerClient } from './server';
import type { Enums, Tables } from './database.types';

export interface AdvisorSession {
  userId: string;
  profile: Tables<'advisor_profiles'>;
  firm: Tables<'firms'>;
}

/** Returns null when unauthenticated or when the user has no advisor profile. */
export async function getAdvisorSession(): Promise<AdvisorSession | null> {
  const supabase = await getServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from('advisor_profiles')
    .select('*')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (!profile) return null;

  const { data: firm } = await supabase
    .from('firms')
    .select('*')
    .eq('id', profile.firm_id)
    .maybeSingle();
  if (!firm) return null;

  return { userId: auth.user.id, profile, firm };
}

export function canWrite(role: Enums<'advisor_role'>): boolean {
  return role === 'principal' || role === 'advisor';
}

export function isPrincipal(role: Enums<'advisor_role'>): boolean {
  return role === 'principal';
}
