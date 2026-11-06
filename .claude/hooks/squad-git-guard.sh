#!/usr/bin/env bash
# squad git guard: a Claude Code PreToolUse hook for Bash.
# Blocks git commands that sweep, discard or rewrite work, and every way of skipping the git
# hooks. /squad init installs it into the host repo's .claude/hooks/, registers it in
# .claude/settings.json and runs squad-git-guard.test.sh against it.
# Adapted from mattpocock/skills git-guardrails-claude-code (read 2026-10-31); plain `git push`
# stays allowed, because Stage 6 needs it. Bypass spellings adapted from affaan-m/ECC
# block-no-verify.js and gateguard-fact-force.js at v2.2.3 (read 2026-11-06), rewritten in bash.
# Portable to BSD and GNU tools: sed -E and grep -E only.
#
# Out of scope, on purpose: commands reached through `bash -c`, `sh -c` or `eval`, whose quoted
# body is not inspected; and `git restore <path>` or `git checkout -- <path>` on a named file,
# which discards one file deliberately.

input="$(cat)"

block() {
  printf 'BLOCKED by the squad git guard: %s\n' "$1" >&2
  cat >&2 <<'MSG'
Commit by explicit path instead: git add <path> && git commit -m "...".
If a stage genuinely needs this command, stop: record it in the build's log.md and halt.
The Orchestrator escalates it to Joel under halt trigger 6 in .squad/CLAUDE.md, and Joel runs it.
MSG
  exit 2
}

# The command as JSON carries it: quotes as \", backslashes as \\, newlines as \n, tabs as \t.
cmd="$(printf '%s' "$input" | tr -d '\n' |
  sed -nE 's/.*"command"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)".*/\1/p')"

# Input the guard cannot read fails closed when it mentions git, and passes when it does not.
if [ -z "$cmd" ]; then
  printf '%s' "$input" | grep -q 'git' && block 'the guard could not read this command'
  exit 0
fi

# Normalise: newline and tab become a separator and a space; a quoted or escaped `git` becomes
# git; every other quoted string is blanked, so a commit message cannot trip or hide a pattern.
norm="$(printf '%s' "$cmd" | sed -E \
  -e 's/\\n/;/g' -e 's/\\t/ /g' -e 's/[[:cntrl:]]/ /g' \
  -e "s/'git'/git/g" -e 's/\\"git\\"/git/g' -e 's/\\\\git/git/g' \
  -e "s/'[^']*'/''/g" -e 's/\\"([^"\\]|\\[^"])*\\"/""/g')"

# A git command starts the string or follows a separator (; & | ( ) { }), may sit behind env,
# sudo, command, exec, time, nohup or a VAR=value assignment, may be called by path, and may
# carry global options (-C <dir>, -c <k=v>, --git-dir <dir>, --work-tree <dir>, --opt=value).
start='(^|[;&|(){}][[:space:]]*)((env|sudo|command|exec|time|nohup|[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*)[[:space:]]+)*([^[:space:];&|(){}]*/)?git[[:space:]]+((-[Cc]|--git-dir|--work-tree|--namespace)[[:space:]]+[^[:space:]]+[[:space:]]+|--[a-z-]+(=[^[:space:]]+)?[[:space:]]+)*'
args='[[:space:]]+([^;&|]*[[:space:]])?'
end='([[:space:]]|$|[;&|)}])'

# Hook bypass by configuration, in any command that runs git, checked on the unblanked text in any
# case and spelling: core.hooksPath, an include that could set it, the environment that carries
# -c, and Husky's off switch.
if printf '%s' "$norm" | grep -Eq -- "$start"; then
  printf '%s' "$cmd" | grep -Eiq 'hookspath|include(if)?[^[:space:]]*\.path' &&
    block 'it redirects or disables the git hooks'
  printf '%s' "$cmd" | grep -Eq 'GIT_CONFIG_(COUNT|PARAMETERS|KEY_)' &&
    block 'it passes git configuration through the environment'
  printf '%s' "$cmd" | grep -Eq '(^|[^A-Za-z0-9_])HUSKY=0' &&
    block 'HUSKY=0 switches the pre-commit hook off'
fi

check() { printf '%s' "$norm" | grep -Eq -- "${start}$1" && block "$2"; }

check "(add|stage)${args}(-A|--all|-u|--update|-[a-zA-Z]*[Au][a-zA-Z]*|\\.|\\./|:/|:/:|\\*)${end}" \
  'it stages the whole tree'
check "commit${args}(--all|-[a-zA-Z]*a[a-zA-Z]*)${end}" 'commit -a stages the whole tree'
check "(commit|push|merge|cherry-pick|rebase|am|revert)${args}--no-v[a-z-]*${end}" \
  'it skips the git hooks'
check "commit${args}-[a-zA-Z]*n[a-zA-Z]*${end}" 'commit -n skips the git hooks'
check "reset${args}--(hard|merge)${end}" 'it discards uncommitted work'
check "clean${args}(-[a-zA-Z]*f[a-zA-Z]*|--force)${end}" 'it deletes untracked files'
check "(checkout|restore)${args}(\\.|\\./|:/|\\*)${end}" 'it discards changes across the tree'
check "(checkout|switch)${args}(-f|--force|--discard-changes)${end}" 'it discards uncommitted work'
check "stash[[:space:]]+(drop|clear)${end}" 'it deletes stashed work'
check "branch${args}(-D|-[a-zA-Z]*D[a-zA-Z]*|--delete[[:space:]]+--force|-d[[:space:]]+--force|--force[[:space:]]+(-d|--delete))${end}" \
  'it deletes a branch with unmerged work'
check "(filter-branch|filter-repo)${end}" 'it rewrites history'
check "push${args}(--force[a-z-]*|-[a-zA-Z]*f[a-zA-Z]*)([[:space:]=]|$|[;&|)}])" 'it force-pushes'
check "push${args}\\+[^[:space:]]+" 'a + refspec force-pushes'

exit 0
