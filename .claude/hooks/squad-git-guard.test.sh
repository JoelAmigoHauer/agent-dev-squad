#!/usr/bin/env bash
# Proves the squad git guard blocks what it says it blocks, and lets ordinary work through (B3-7:
# a guard nobody has seen refuse anything is a check that could not fail).
# /squad init runs it after installing the guard; Preflight runs it again. Exit 0 means every case
# came out as expected. Usage: squad-git-guard.test.sh [path/to/squad-git-guard.sh]
#
# Each case is `<expected exit> | <command as a stage would type it>`. 2 = blocked, 0 = allowed.
# <TAB> stands for a tab character.

guard="${1:-$(dirname "$0")/squad-git-guard.sh}"
[ -f "$guard" ] || { echo "FAIL: no guard at $guard" >&2; exit 1; }

fail=0
total=0
while IFS= read -r line; do
  case "$line" in ''|'#'*) continue ;; esac
  want="${line%% | *}"
  shell="${line#* | }"
  shell="${shell//<TAB>/$'\t'}"
  # Encode the command the way Claude Code's hook input does.
  json="$(printf '%s' "$shell" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | sed -e $'s/\t/\\\\t/g')"
  printf '{"tool_name":"Bash","tool_input":{"command":"%s","description":"x"}}' "$json" |
    bash "$guard" >/dev/null 2>&1
  got=$?
  total=$((total + 1))
  if [ "$got" != "$want" ]; then
    echo "FAIL: expected $want, got $got: $shell" >&2
    fail=$((fail + 1))
  fi
done <<'CASES'
# Sweeps
2 | git add -A
2 | git add .
2 | git add --all
2 | git add -u
2 | git add -- .
2 | git add ./
2 | git add :/
2 | git add *
2 | git stage -A
2 | git commit -am "fix"
2 | git commit --all -m "fix"
# Skipping the hooks
2 | git commit --no-verify -m x
2 | git commit --no-veri -m x
2 | git commit -n -m x
2 | git commit -anm x
2 | git push --no-verify
2 | git merge --no-verify feat
2 | git -c core.hooksPath=/dev/null commit -m x
2 | git -c core.hookspath=/dev/null commit -m x
2 | git -c "core.hooksPath=/dev/null" commit -m x
2 | git config core.hooksPath /dev/null
2 | HUSKY=0 git commit -m x
2 | export HUSKY=0; git commit -m x
2 | GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git commit -m x
# Discards
2 | git reset --hard
2 | git reset --hard HEAD~1
2 | git reset --merge HEAD~1
2 | git clean -fd
2 | git clean --force
2 | git checkout .
2 | git checkout -- .
2 | git restore .
2 | git restore --worktree .
2 | git checkout -f main
2 | git switch -f main
2 | git switch --discard-changes main
2 | git stash drop
2 | git stash clear
2 | git branch -D feat
# Rewrites
2 | git push --force
2 | git push -f origin main
2 | git push -fu origin main
2 | git push --force-with-lease origin main
2 | git push origin +main
2 | git filter-branch --force
# The same commands behind wrappers, quotes, paths and global options
2 | 'git' reset --hard
2 | "git" reset --hard
2 | \git reset --hard
2 | env git add -A
2 | sudo git reset --hard
2 | command git reset --hard
2 | x=1 git reset --hard
2 | GIT_DIR=.git git reset --hard
2 | /usr/bin/git reset --hard
2 | (git reset --hard)
2 | { git reset --hard; }
2 | echo $(git reset --hard)
2 | true; git reset --hard
2 | cd /x && git reset --hard
2 | git commit -m "fix" && git reset --hard
2 | git -C . reset --hard
2 | git --git-dir=.git reset --hard
2 | git --work-tree . reset --hard
2 | git -c x=y reset --hard
2 | git reset<TAB>--hard
# Ordinary work stays allowed
0 | git status
0 | git add src/app.ts
0 | git add src/a-u.ts docs/x.md
0 | git add .squad .claude/settings.json
0 | git commit -m "Block git add -A and reset --hard in the guard"
0 | git commit -m 'explain why -n and --no-verify are refused'
0 | git commit --amend --no-edit
0 | git add src/app.ts && git commit -m "fix: tenancy check"
0 | git push
0 | git push -u origin feature-x
0 | git push --follow-tags origin main
0 | git checkout -b feature-x
0 | git checkout -- src/app.ts
0 | git restore --staged src/app.ts
0 | git reset HEAD src/app.ts
0 | git branch -d merged-branch
0 | git stash
0 | git clean -n
0 | git log --oneline -5
0 | git diff --stat
0 | grep -rn hooksPath .squad/
0 | echo HUSKY=0 is refused by the guard
0 | npm run build
CASES

echo "squad git guard: $((total - fail)) of $total cases as expected"
[ "$fail" -eq 0 ]
