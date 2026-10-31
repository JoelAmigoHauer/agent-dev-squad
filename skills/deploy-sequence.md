# Skill — Deploy sequence

**Loads when:** DevOps reaches Stage 6 and names this file. By path, never on keyword match — the
word "deploy" appearing in an earlier stage must not pull this into context.
**Cap:** 2 attempts. A deploy that fails twice escalates with build logs. Never retried blind.

---

## 0. Preconditions

Do not start until all of these are true. Check them, do not assume them.

- [ ] QA reports full suite green (`test-results.md`), **including the Playwright E2E layer**. An
      API-only green is not a green.
- [ ] No flow in `test-results.md` is `blocked`, unless Joel has accepted that gap in writing. A
      flow skipped for a missing credential has not been tested (B3-4).
- [ ] Security reports pass with no outstanding **blocking** findings (`security-review.md`), with
      advisors, `npm audit`, `gitleaks` and `semgrep` all run.
- [ ] Type check and lint pass.
- [ ] No secrets in the repo or in client-exposed variables.
- [ ] No `pending` line in `/state/<app-name>.md` names an amendment set (B3-2). client-portal's
      amendment set 6 had no stage lines, and v1 reached `main` with much of it unbuilt.
- [ ] Nothing production reads points at the test target: no production variable holds
      `localhost:54321` or the test target's project ref (B3-3).
- [ ] The function region matches the contract's residency clause, if it has one (B3-22).
      client-portal bound its data to Sydney while its functions ran in `iad1`, Vercel's default,
      so client data was processed in the US on every request.
- [ ] A build that sends email to anyone outside the Supabase project team has custom SMTP set
      before its first send (B3-5). The built-in mailer sends only to the project team's addresses,
      two an hour (Supabase docs, read 2026-09-28), so without SMTP no invite reaches a client.

Non-blocking security findings do not stop you. Carry them into the deploy record.

---

## 1. Wire environment variables

For each environment (development, preview, production):

1. List every variable the contract and `build-notes.md` require.
2. Set each one. Use the Vercel CLI or project settings — never commit values.
3. Audit client-exposed variables **one by one**. A public prefix is a declaration, not a
   guarantee. Confirm each exposed value is genuinely safe to expose.
4. Confirm the Supabase service-role key is server-side only.
5. Confirm sandbox and production third-party credentials are separate values, not the same key in
   two places.
6. **Preview and development point at the contract's test target**, never at production's
   database or service-role key (B3-3). Every preview otherwise carries production's keys.

```bash
vercel env ls
```

**After any variable change, redeploy, and confirm the deployment is newer than the change**
(B3-11). A variable set after a build does nothing to that build. client-portal made two variables
available 66 and 80 seconds after a preview built; they did nothing to it, and Joel met the old
behaviour as "Too many attempts".

A missing variable that only surfaces on first user request is a failed deploy, not a small bug.

---

## 2. Connect Supabase

- Confirm the deployed environment points at the intended Supabase project, by project ref.
- Confirm it is **not** pointing at a local instance, a branch database or the test target.
- Apply any pending migrations, and record whether each is reversible.
- **Apply them in the order the contract's §2 *Migration ordering* table sets** (WH-25). "Additive"
  answers only whether the migration breaks the deployed code; whether the new code fails against
  the old schema is a separate answer, and it decides whether the migration *must* go first.
  Carry both answers into the deploy record.
- **Magic-link or email sign-in:** set the Supabase Auth **Site URL** and **redirect allowlist** to
  the production origin (B2-3). No connector exposes them as at 2026-09-11, so this is an
  owner-side step. Until it is confirmed, the deploy record lists it as a remaining item; a sent
  link otherwise redirects to localhost.

If a migration is not reversible, say so **before** promoting. A code rollback against a migrated
schema is a second incident, not a recovery.

---

## 3. Deploy to preview

Always preview first. Even for a trivial build.

**Link the project before any deploy, then read the link back** (WH-20):

```bash
npx vercel link --yes --project <contract's project name> --scope <team>
cat .vercel/project.json   # projectName must match the contract's project
```

`.vercel/` is git-ignored, so a fresh container starts unlinked, and `--yes` turns "which
project?" into silently creating a new one named after the directory. workshop-hub-end's first
deploy created a project called `app`, linked it to the repository, and that stray project then
built every later push until someone noticed. Record the `projectName` you read back.

**A new project in an existing repository** (B2-2, corrected by B3-11). Create it git-linked, with
`rootDirectory` and the full environment in the one call: no connector sets variables on a
git-linked project afterwards, so the create call or the dashboard is the only route. Set
protection to Standard Protection (`prod_deployment_urls_and_all_previews`) and confirm the
production alias is public. Do not scope protection to `preview`: Vercel documents that scope as
legacy, protecting only preview URLs, and client-portal's 30 superseded production deployments
stayed public under it. A project rooted in a subdirectory gets an **Ignored Build Step** on that
subdirectory, or it rebuilds on every push to the repository.

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

On the preview build: type check, lint, full test suite. All green. **Record each check that ran,
by name** (B3-11). Next 16's `next build` runs no lint, so "CI: passed" on a build alone carried no
lint evidence for client-portal.

A red CI on preview stops the sequence here. It does not consume a deploy attempt — you have not
promoted anything. Fix and re-preview.

---

## 5. Smoke test the preview

Against the **contract's core user flows**, not a general poke around:

- App loads.
- Auth: sign in, and one refused access as the wrong actor.
- One complete write path, end to end, verified in the database.
- **One service-role write path, end to end** (B2-1). For a magic-link build, a sign-in request
  that returns 200 and writes its rate-limit row. client-portal's rate limiter was unreachable by
  the admin client, failed closed, and made sign-in impossible; a smoke test of "app loads, access
  refused" could not see it.

**Mark each assertion `discriminating` or `liveness`** (B3-7). A liveness check passes on the
previous deployment too; it proves the app is up, not that this build is in it. Show at least one
discriminating assertion **failing on the previous deployment** before trusting it here.
client-portal's Orchestrator called deploy 2 ready on a `307` the previous build also returned.

**Smoke data carries the prefix `squad-smoke-`** (WH-17), so step 7 can remove it.

**On a git-linked project, smoke-test the preview of the exact SHA you will merge** (B3-11). A
preview of a different commit tests something else.

---

## 6. Record the rollback target, then promote

Capture the currently-live deployment ID **before** you promote. That ID is the rollback target and
you will not be able to find it calmly during an incident.

```bash
vercel ls --prod
```

**Record its commit and its age** (WH-18). If it is behind the base branch by more than this
build's own commits, say so in the deploy record: rolling back to it is a regression, not a
recovery, and Joel decides in advance whether that is acceptable. workshop-hub's production had
pointed at a month-old deployment while nine later commits sat as unpromoted previews. A rollback
target older than a migration this deploy applies is recorded as **unsafe** (B3-11).

Then promote, by one of two paths (WH-23), and record which:

| When | Path |
|---|---|
| Preview and production environment variables match | `vercel promote <preview-id>` |
| They differ (every project holding a secret) | `vercel --prod` from the identical tree, then **prove equivalence**: diff what production serves against the tested preview and account for every difference (Vercel injects a preview feedback script) |

`vercel promote` refuses a preview built with preview variables, and offers to rebuild with
production ones; workshop-hub-end met that refusal mid-deploy with no written branch for it.

**On a git-linked project, the merge to the production branch is the promote** (B3-11). Whoever
merges deploys, whether Stage 6 is running or not. Merge only with Stage 6 `running` in
`/state/<app-name>.md`, after step 5 passed on that exact SHA. client-portal's deploy 2 was a
fast-forward push of `main`, and Stage 6 was fired afterwards to verify only.

---

## 7. Verify production

- App loads on the production URL.
- Auth works.
- One write path succeeds end to end.
- The service-role write path succeeds end to end.
- The discriminating assertion from step 5 passes here.

If any of these fail, roll back immediately — do not debug in production.

**Then remove the smoke data** (WH-17). Delete every row keyed to `squad-smoke-`, in every table the
smoke test wrote, and record the counts in the deploy record. workshop-hub's verification left three
sessions, nine candidates, ten votes and twenty-four rows in the only database the app has, and
deleting them took a service-role statement no brief mentioned.

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
