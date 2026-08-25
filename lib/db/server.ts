import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing environment variable: ${name}`);
  return value;
}

/** Request-scoped client carrying the advisor's session. RLS applies. Use this by default. */
export async function getServerClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies are read-only. Middleware refreshes
            // the session, so swallowing this is correct rather than merely convenient.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * Only two things may use it: the ledger writer (there is deliberately no INSERT policy on
 * decision_ledger, so nothing else can append) and the agent runtime, which acts as a distinct
 * non-advisor identity. Every other path uses getServerClient so that a bug in a route cannot
 * read across firms.
 */
export function getServiceClient() {
  return createClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
