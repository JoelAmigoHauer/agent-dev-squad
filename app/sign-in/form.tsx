'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/db/database.types';

type State = 'idle' | 'submitting' | 'magic_sent';

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);

  // Constructed lazily, inside the handler. At module scope this throws during prerender when
  // the build environment has no Supabase keys, which fails the whole build for a page that
  // does not need a client until someone submits it.
  const client = () => createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setState('submitting');
    setError(null);
    const { error: signInError } = await client().auth.signInWithPassword({ email, password });
    if (signInError) {
      // The message is shown verbatim rather than paraphrased — a rate-limit and a wrong password
      // need different actions from the advisor, and "sign in failed" hides which it was.
      setError(signInError.message);
      setState('idle');
      return;
    }
    router.push('/');
    router.refresh();
  }

  async function sendMagicLink() {
    setState('submitting');
    setError(null);
    const { error: linkError } = await client().auth.signInWithOtp({ email });
    if (linkError) { setError(linkError.message); setState('idle'); return; }
    setState('magic_sent');
  }

  if (state === 'magic_sent') {
    return (
      <div className="rounded-lg border border-border bg-surface p-5 text-center">
        <p className="font-medium">Check your email</p>
        <p className="mt-1 text-text-muted">A sign-in link is on its way to {email}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={signIn} className="space-y-3 rounded-lg border border-border bg-surface p-5">
      <label className="block">
        <span className="text-text-muted">Email</span>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
               autoComplete="username"
               className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2" />
      </label>
      <label className="block">
        <span className="text-text-muted">Password</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
               autoComplete="current-password"
               className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2" />
      </label>

      {error && (
        <p role="alert" className="rounded-md bg-negative-subtle px-3 py-2 text-negative">{error}</p>
      )}

      <button type="submit" disabled={state === 'submitting'}
              className="w-full rounded-md bg-accent px-3 py-2 font-medium text-white disabled:opacity-60">
        {state === 'submitting' ? 'Signing in…' : 'Sign in'}
      </button>
      <button type="button" onClick={sendMagicLink} disabled={state === 'submitting' || !email}
              className="w-full rounded-md border border-border px-3 py-2 disabled:opacity-60">
        Email me a sign-in link
      </button>
    </form>
  );
}
