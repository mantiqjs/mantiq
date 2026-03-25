---
name: issues
description: Pick and fix GitHub issues by priority — security first, then bugs, then features
user_invocable: true
args: "[count] — number of issues to fix (default: 5)"
---

# Issue Worker

You are a focused issue worker. Pick open GitHub issues, fix them by priority, and ship.

## Priority Order

1. **security:** — CRITICAL, fix immediately
2. **bug:** — HIGH, fix next
3. **feat:** — MEDIUM, implement if time

## Process

For each issue:

### 1. Fetch & Prioritize
```bash
gh issue list --repo mantiqjs/mantiq --state open --json number,title,labels --jq '.[] | "#\(.number) \(.title)"'
```
Sort by: security > bug > feat. Within each category, lower issue numbers first (older = higher priority).

### 2. Read the Issue
```bash
gh issue view <number> --repo mantiqjs/mantiq --json body --jq '.body'
```
Understand the problem, file, and suggested fix.

### 3. Verify It's Not Already Fixed
- Read the file mentioned in the issue
- Check if the bug still exists in current code
- If already fixed, close the issue with a comment explaining when it was fixed

### 4. Fix It
- Read the file first
- Apply the minimal fix
- Add a test if the fix is non-trivial
- Do NOT over-engineer — smallest change that fixes the issue

### 5. After Each Fix
- Run typecheck: `bun run typecheck`
- Run affected tests: `bun test packages/<affected>/tests/`
- If tests pass, continue to next issue
- If tests fail, fix them before moving on

### 6. Batch Commit
After fixing the batch (default 5 issues, or count specified by user):
```bash
git add -A
git commit -m "fix: close #X, #Y, #Z — <one-line summary>"
git push origin next
```

### 7. Close Issues
```bash
for issue in X Y Z; do
  gh issue close $issue --repo mantiqjs/mantiq --comment "Fixed on next branch."
done
```

### 8. Create PR
```bash
gh pr create --base master --head next --title "fix: <count> issues — <summary>" --body "Closes #X #Y #Z ..."
```

## Rules

- NEVER merge PRs — only create them. CI must pass first.
- NEVER publish packages — that's a separate workflow.
- NEVER skip tests after fixes.
- If an issue requires a design decision, skip it and note "Skipped #N — needs design discussion".
- If an issue is a duplicate of another, close as duplicate.
- If an issue describes something that's actually working correctly, close as "works as intended" with explanation.
- Maximum 10 issues per batch to keep PRs reviewable.

## Arguments

- `/issues` — fix next 5 issues by priority
- `/issues 3` — fix next 3 issues
- `/issues 10` — fix next 10 issues
- `/issues security` — fix only security issues
- `/issues bug` — fix only bug issues
