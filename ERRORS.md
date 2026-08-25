# Durable machine facts

Per-machine and cumulative. Written by Preflight (Stage 0.5) whenever a run turns up a fact about
the *machine* rather than the build. Rediscovering these every run is pure waste.

This is **not** the same file as `/builds/<app-name>/preflight.md`. That one is a per-build
snapshot. This one outlives builds. Do not merge them.

Every entry is dated. An undated fact about a tool is the exact failure v0.1's tooling table
produced. If a later run finds an entry no longer true, edit it in place and re-date it — a stale
fact here is worse than no fact.

---

## Claude Code remote container (`claude/*` sessions)

Facts below were probed on the remote execution container, not on a local workstation. A run on
Joel's own machine may find different answers.

### `gh` CLI is not installed — as at 2026-08-24

`command -v gh` → nothing. Git itself is present (2.43.0) and authenticated for push.

**Route instead:** the GitHub MCP server (`mcp__github__*`). Everything Stage 6 needs — PRs,
comments, checks, secret scanning — is there. No capability is lost, only the invocation.

Do not spend a stage trying to install it. Attempting to fetch it from GitHub releases fails, see
below.

### Docker daemon is absent — as at 2026-08-24

`docker info` → `dial unix /var/run/docker.sock: connect: no such file or directory`. There is no
socket, so this is not "daemon stopped", it is "no daemon here".

**Two consequences that bite specific stages:**

1. `supabase start` cannot run. There is no local Postgres stack. QA must use a hosted Supabase
   branch instead. Confirm branching is available for the org first — `get_cost(type: branch)`
   returning a non-zero rate means yes.
2. Any tool distributed only as a container is unavailable. `gitleaks`, whose supported route on
   this pipeline is the `ghcr.io/gitleaks/gitleaks` image, is the one that matters.

### GitHub release downloads return 403 through the agent proxy — as at 2026-08-24

`curl -sSI https://github.com/gitleaks/gitleaks/releases/latest` → `403`.

Package registries are exempt and work fine — `registry.npmjs.org`, `pypi.org`,
`files.pythonhosted.org`, `jsr.io`, `index.crates.io` are all in the proxy's `noProxy` list. It is
specifically the *release binary* route that fails.

**Practical rule:** a tool installable from npm or PyPI is available on this machine. A tool
distributed only as a GitHub release binary or a container image is not. Check which before
planning a stage around it.

### `pipx` is absent and `pip --break-system-packages` collides — as at 2026-08-24

`pipx` is not installed. Python is 3.11.15 and the environment is PEP-668 managed, so a bare
`pip install` refuses.

`pip install --break-system-packages semgrep` **also** fails, but not obviously — it dies on
`Cannot uninstall PyJWT 2.7.0, RECORD file not found. Hint: The package was installed by debian.`
The error names PyJWT, so it reads like a PyJWT problem. It is not; it is the Debian-managed
site-packages refusing to be overwritten.

**Working route — use a venv:**

```bash
python3 -m venv /opt/semgrep-venv
/opt/semgrep-venv/bin/pip install semgrep
/opt/semgrep-venv/bin/semgrep --version    # 1.174.0 as at 2026-08-24
```

The binary is **not** on `PATH`. Any stage invoking it must use the full path. A stage that runs
`semgrep ...` and gets `command not found` has hit this, not a missing install.

This supersedes the `pipx` route recorded during build 1 (`2026-08-15`) **for this machine only**.
On a machine with `pipx`, prefer it.

### Playwright browsers are pre-installed — as at 2026-08-24

`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` with `chromium-1194` and
`chromium_headless_shell-1194` already present. `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` is set so npm
postinstall will not re-fetch them.

**Do not run `playwright install`.** If a project pins a different `@playwright/test` version than
the pre-installed browser build, launch with `executablePath: '/opt/pw-browsers/chromium'` rather
than downloading.

### `API_KEY_21ST` is not set — as at 2026-08-24

The 21st.dev account is on a **paid, unmetered** tier and the MCP tools work, so `get_usage`
reports healthy and a Preflight that stops there passes it.

But every `installCommand` the catalogue returns looks like:

```
npx shadcn@latest add "https://21st.dev/r/<author>/<component>?api_key=$API_KEY_21ST"
```

and that variable is **not in the environment**. The command resolves to an empty key and fails.

**Working route:** retrieve through the MCP `get_component` tool, which returns the code directly,
and vendor it into the project's `components/ui/`. Same code, no CLI, no key.

**Preflight probe gap this exposes:** tier and install path are two different failures. A tier probe
answers "may I retrieve?" and says nothing about "can this machine install?". The 21st.dev row needs
both cells. Found at Stage 2 of the `thelma` build, which is one stage later than it should have
been.
