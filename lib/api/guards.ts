import { getAdvisorSession, canWrite, isPrincipal, type AdvisorSession } from '@/lib/db/session';
import { forbidden, unauthorized } from './respond';
import { NextResponse } from 'next/server';

type Guarded<T> = { session: AdvisorSession } | { response: NextResponse<T> };

export async function requireSession(): Promise<Guarded<unknown>> {
  const session = await getAdvisorSession();
  if (!session) return { response: unauthorized() };
  return { session };
}

export async function requireWriter(): Promise<Guarded<unknown>> {
  const result = await requireSession();
  if ('response' in result) return result;
  if (!canWrite(result.session.profile.role)) return { response: forbidden('readonly_role') };
  return result;
}

export async function requirePrincipal(): Promise<Guarded<unknown>> {
  const result = await requireSession();
  if ('response' in result) return result;
  if (!isPrincipal(result.session.profile.role)) return { response: forbidden('principal_only') };
  return result;
}
