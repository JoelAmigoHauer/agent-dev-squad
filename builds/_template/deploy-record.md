# Deploy record — <app-name>

Written by: DevOps, Stage 6.

**Variable names only. Never values.**

---

```
BUILD: 
DEPLOYED: <ISO timestamp>
PRODUCTION URL: 
DEPLOYMENT ID: 
PREVIOUS DEPLOYMENT ID: <this is the rollback target>
SUPABASE PROJECT: <project ref>
MIGRATIONS APPLIED: <list, or none>
MIGRATION REVERSIBLE: yes | no
ENV VARS SET: <names only>
CI: passed
SMOKE TEST: <flows tested, result>
NON-BLOCKING SECURITY FINDINGS CARRIED FORWARD: <list, or none>
ATTEMPTS: 1 | 2
```

---

## Preconditions verified

- [ ] QA full suite green
- [ ] Security pass, no outstanding blocking findings
- [ ] Type check and lint pass
- [ ] No secrets in repo or client-exposed variables

---

## Preview

```
PREVIEW URL: 
CI ON PREVIEW: 
SMOKE TEST ON PREVIEW: <app loads / auth in / one refused access / one write path>
```

---

## Production verification

- [ ] App loads
- [ ] Auth works
- [ ] One write path succeeds end to end

Any failure here → roll back immediately. Do not debug in production.

---

## Rollback plan

```
ROLLBACK TARGET: <previous deployment ID>
ACTION: promote that deployment back to production
DATABASE: n/a | reversible migration, revert with <...> | IRREVERSIBLE — rollback is an escalation to Joel
```

---

## Post-deploy

- [ ] App added to the scheduled scan set (nightly security re-scan, weekly dependency staleness)
