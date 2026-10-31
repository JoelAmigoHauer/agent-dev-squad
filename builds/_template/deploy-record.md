# Deploy record — <app-name>

Written by: DevOps, Stage 6.

**Variable names only. Never values.**

---

```
BUILD: 
DEPLOYED: <ISO timestamp>
PRODUCTION URL: 
VERCEL PROJECT: <projectName read back from .vercel/project.json>
DEPLOYMENT ID: 
PREVIOUS DEPLOYMENT ID: <this is the rollback target>
ROLLBACK TARGET: <commit>, <age>; <n> commits behind base | regression caveat | unsafe
FUNCTION REGION: <region>, matches residency clause | n/a
SUPABASE PROJECT: <project ref>
MIGRATIONS APPLIED: <list, or none>
MIGRATION REVERSIBLE: yes | no
MIGRATION ORDER: breaks deployed code? ; new code fails on old schema? ; applied before | after deploy
ENV VARS SET: <names only>
CI: <each check that ran, by name>
SMOKE TEST: <each assertion: flow, discriminating | liveness, result>
DISCRIMINATING CHECK FAILED ON PREVIOUS DEPLOYMENT: 
SERVICE-ROLE WRITE PATH: 
PROMOTE PATH: promote | --prod from same tree, equivalence shown by <how>
SMOKE DATA REMOVED: <table: count>
FLOWS NEVER RUN END TO END: none | <list>
REMAINING OWNER STEPS: none | <list>
NON-BLOCKING SECURITY FINDINGS CARRIED FORWARD: <list, or none>
ATTEMPTS: 1 | 2
```

---

## Preconditions verified

- [ ] QA full suite green, no `blocked` flow unaccepted
- [ ] Security pass, no outstanding blocking findings
- [ ] Type check and lint pass
- [ ] No secrets in repo or client-exposed variables
- [ ] No `pending` amendment-set line in `/state/<app-name>.md`
- [ ] Nothing production reads points at the test target
- [ ] Function region matches the residency clause, if any
- [ ] Custom SMTP set, if the build emails anyone outside the project team

---

## Preview

```
PREVIEW URL: 
CI ON PREVIEW: 
SMOKE TEST ON PREVIEW: <app loads / auth in / one refused access / one write path / one service-role write path>
PREVIEW SHA: <on a git-linked project, the exact SHA to be merged>
```

---

## Production verification

- [ ] App loads
- [ ] Auth works
- [ ] One write path succeeds end to end
- [ ] Service-role write path succeeds end to end
- [ ] Discriminating assertion passes
- [ ] `squad-smoke-` data removed, counts recorded

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
