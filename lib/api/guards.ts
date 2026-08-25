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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Path params reach the database directly. Supabase parameterises the value so there is no
 * injection, but an id that is not a UUID makes Postgres raise, which surfaces as a 500 with a
 * log ref — telling the caller their input reached the data layer, and burying a real 500 in
 * noise. A non-UUID id is simply not found.
 */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
