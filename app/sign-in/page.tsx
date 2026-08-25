import { SignInForm } from './form';

/** No sign-up link and no "create account" copy anywhere: the contract forbids public sign-up on
 *  a system holding custodial positions, and the UI must not imply one exists. design.md S1. */
export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Thelma</h1>
          <p className="mt-1 text-text-muted">Advisor sign in</p>
        </div>
        <SignInForm />
        <p className="mt-6 text-center text-xs text-text-subtle">
          Access is by invitation from your firm&apos;s principal.
        </p>
      </div>
    </main>
  );
}
