# Security review — <app-name>

Written by: Security, Stage 5. Runs in parallel with QA.

---

## Verdict

```
VERDICT: pass | fail
ITERATION: <n>/2
```

| Layer | Tool | Run | Result |
|---|---|---|---|
| Database | Supabase advisors | | |
| Dependencies | `npm audit --audit-level=high` | | |
| Secrets | `gitleaks detect` (incl. history) | | |
| App code | `semgrep --config auto` | | |
| Business logic | manual checks below | | |

A clean automated run means the known-pattern layers are clean. It is not a verdict on its own —
no scanner knows what the contract's auth rules say.

---

## Supabase advisor output

Run after every schema change. Verbatim:

```

```

Specifically checked:
- [ ] RLS present on every table
- [ ] No policy permissive to the point of decorative (`using (true)` on tenant-scoped tables)
- [ ] Advisor-flagged vulnerabilities resolved

---

## Manual checks

### Auth
- [ ] Enforced server-side, not by client redirect
- [ ] Every tenant-data route checks caller identity, not just session existence
- [ ] Session handling matches the contract's auth requirements
- [ ] No route trusts a user-supplied `org_id` / `user_id` / role claim

### Secrets
- [ ] None in repo, client bundles, or error messages
- [ ] Env vars referenced, never inlined
- [ ] Every client-exposed variable audited individually and genuinely safe
- [ ] Service-role key never reaches the browser

### Input validation
- [ ] On all routes, at the server boundary — not only the ones with a form
- [ ] Matches schema constraints
- [ ] File uploads: type and size limits, no path traversal in storage keys

### Third-party integrations
- [ ] Webhook signature verification present and enforced
- [ ] Keys minimally scoped and environment-specific
- [ ] No PII beyond what the integration requires
- [ ] Sandbox and production credentials separate

---

## Findings

```
FINDING <n> — <title>
SEVERITY: blocking | non-blocking
LOCATION: <file:line or route>
ISSUE: 
IMPACT: <what an attacker or a mistake gets>
FIX: <the specific change required>
```

Blocking stops the deploy. Non-blocking is recorded and carried into the deploy record.

Be honest about severity — inflating everything to blocking makes the distinction useless.

---

## Loop history

| Iteration | Findings | Full re-review | Result |
|---|---|---|---|
| 1 | | | |
| 2 | | | cap — halt and escalate to Joel at Architect level |
