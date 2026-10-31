#!/usr/bin/env bash
# squad git guard: a Claude Code PreToolUse hook for Bash.
# Blocks git commands that sweep, discard or rewrite work. /squad init installs it into the host
# repo's .claude/hooks/ and registers it in .claude/settings.json.
# Adapted from mattpocock/skills git-guardrails-claude-code (read 2026-10-31); plain `git push`
# stays allowed, because Stage 6 needs it.

input="$(cat)"

# A git command starts the command string, follows a separator (; & | && || a subshell), or starts
# a new line (JSON encodes it as \n). Global options such as -C <dir> may sit before the verb.
start='(^|"command"[[:space:]]*:[[:space:]]*"|[;&|(][[:space:]]*|\\n[[:space:]]*)git[[:space:]]+(-[Cc][[:space:]]+[^[:space:]"]+[[:space:]]+|--[a-z-]+(=[^[:space:]"]+)?[[:space:]]+)*'

patterns=(
  "${start}add[[:space:]]+(-A|--all|\\.)([[:space:]]|$|\"|\\\\)"
  "${start}reset[[:space:]]+([^\"]*[[:space:]])?--hard"
  "${start}clean[[:space:]]+([^\"]*[[:space:]])?-[a-zA-Z]*f"
  "${start}(checkout|restore)[[:space:]]+(--[[:space:]]+)?\\.([[:space:]]|$|\"|\\\\)"
  "${start}push[[:space:]]+([^\"]*[[:space:]])?(--force|--force-with-lease|-f)([[:space:]=]|$|\"|\\\\)"
  "${start}push[[:space:]]+([^\"]*[[:space:]])?\\+[^[:space:]\"]+"
)

for p in "${patterns[@]}"; do
  if printf '%s' "$input" | grep -Eq -- "$p"; then
    cat >&2 <<'MSG'
BLOCKED by the squad git guard. This command sweeps, discards or rewrites work.
Commit by explicit path instead: git add <path> && git commit -m "...".
If a stage genuinely needs this command, stop: record it in the build's log.md and halt.
The Orchestrator escalates it to Joel under halt trigger 6 in .squad/CLAUDE.md, and Joel runs it.
MSG
    exit 2
  fi
done
exit 0
