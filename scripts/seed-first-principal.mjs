/**
 * First user — contract §1, as amended by A4.
 *
 * A pure SQL migration cannot read process environment variables, so the mechanism the contract
 * originally named was unimplementable. This script is the amended mechanism: it runs against the
 * DEPLOYED database with the service role, and is idempotent so a redeploy does not fail.
 *
 * It never sets a password. The principal receives an invite and owns their own credential —
 * a system holding custodial positions must not have an account whose password someone else chose.
 *
 * Usage: node scripts/seed-first-principal.mjs
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *           FIRST_FIRM_NAME, FIRST_PRINCIPAL_EMAIL
 */

import { createClient } from '@supabase/supabase-js';

const required = [
  'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
  'FIRST_FIRM_NAME', 'FIRST_PRINCIPAL_EMAIL',
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`seed: missing environment: ${missing.join(', ')}`);
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const email = process.env.FIRST_PRINCIPAL_EMAIL.toLowerCase();
const firmName = process.env.FIRST_FIRM_NAME;

// Idempotent: if a principal already exists, this deploy is not the first one.
const { data: existing } = await supabase
  .from('advisor_profiles').select('id, email').eq('role', 'principal').limit(1).maybeSingle();
if (existing) {
  console.log(`seed: principal already exists (${existing.email}), nothing to do`);
  process.exit(0);
}

const { data: firm, error: firmError } = await supabase
  .from('firms').insert({ name: firmName, shadow_mode: true }).select('id').single();
if (firmError) { console.error('seed: firm insert failed:', firmError.message); process.exit(1); }

const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email);
let userId = invited?.user?.id;

if (inviteError) {
  // Already in auth.users from a previous partial run — reuse rather than fail the deploy.
  const { data: list } = await supabase.auth.admin.listUsers();
  userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;
  if (!userId) { console.error('seed: invite failed:', inviteError.message); process.exit(1); }
}

const { error: profileError } = await supabase.from('advisor_profiles').insert({
  id: userId, firm_id: firm.id, full_name: email.split('@')[0], email, role: 'principal',
});
if (profileError) { console.error('seed: profile insert failed:', profileError.message); process.exit(1); }

console.log(`seed: firm "${firmName}" created, principal ${email} invited. ` +
            'They set their own password from the invite email.');
