# Skill — Deploy sequence

**Loads when:** DevOps reaches Stage 6 and names this file. By path, never on keyword match — the
word "deploy" appearing in an earlier stage must not pull this into context.
**Cap:** 2 attempts. A deploy that fails twice escalates with build logs. Never retried blind.

---

## 0. Preconditions

Do not start until all four are true. Check them, do not assume them.

- [ ] QA reports full suite green (`test-results.md`), **including the Playwright E2E layer**. An
      API-only green is not a green.
- [ ] Security reports pass with no outstanding **blocking** findings (`security-review.md`), with
      advisors, `npm audit`, `gitleaks` and `semgrep` all run.
- [ ] Type check and lint pass.
- [ ] No secrets in the repo or in client-exposed variables.
- [ ] QA's local Supabase stack is stopped, and no env var still points at `localhost:54321`.

Non-blocking security findings do not stop you. Carry them into the deploy record.

---

## 1. Wire environment variables

For each environment (preview, production):

1. List every variable the contract and `build-notes.md` require.
2. Set each one. Use the Vercel CLI or project settings — never commit values.
3. Audit client-exposed variables **one by one**. A public prefix is a declaration, not a
   guarantee. Confirm each exposed value is genuinely safe to expose.
4. Confirm the Supabase service-role key is server-side only.
5. Confirm sandbox and production third-party credentials are separate values, not the same key in
   two places.

```bash
vercel env ls
```

A missing variable that only surfaces on first user request is a failed deploy, not a small bug.

---

## 2. Connect Supabase

- Confirm the deployed environment points at the intended Supabase project, by project ref.
- Confirm it is **not** pointing at a local instance or a branch database.
- Apply any pending migrations, and record whether each is reversible.

If a migration is not reversible, say so **before** promoting. A code rollback against a migrated
schema is a second incident, not a recovery.

---

## 3. Deploy to preview

Always preview first. Even for a trivial build.

**Except on deployment one — v0.2.** Vercel assigns a project's first deployment to production
regardless of flags. Do not treat that as a skipped step: record in the deploy record that no
rollback target exists, verify production before sharing the URL, and set preview environment
variables before deployment two. `vercel env add … preview` prompts for a git branch and will not
complete non-interactively.

```bash
vercel
```

Record the resulting preview URL.

---

## 4. Confirm CI

On the preview build: type check, lint, full test suite. All green.

A red CI on preview stops the sequence here. It does not consume a deploy attempt — you have not
promoted anything. Fix and re-preview.

---

## 5. Smoke test the preview

Against the **contract's core user flows**, not a general poke around:

- App loads.
- Auth: sign in, and one refused access as the wrong actor.
- One complete write path, end to end, verified in the database.

---

## 6. Record the rollback target, then promote

Capture the currently-live deployment ID **before** you promote. That ID is the rollback target and
you will not be able to find it calmly during an incident.

```bash
vercel ls --prod
```

Then promote:

```bash
vercel --prod
```

---

## 7. Verify production

- App loads on the production URL.
- Auth works.
- One write path succeeds end to end.

If any of these fail, roll back immediately — do not debug in production.

---

## Rollback

Promote the previously-recorded deployment back to production. If the deploy included an
irreversible migration, rollback is an escalation to Joel, not a command you run.

---

## 8. Write the deploy record

To `/builds/<app-name>/deploy-record.md`, using the template in
[../agents/devops.md](../agents/devops.md). **Variable names only, never values.**

---

## Platform notes

In [../agents/devops.md](../agents/devops.md), which is already loaded whenever this skill is.
Kept in one place so the two cannot drift apart.
