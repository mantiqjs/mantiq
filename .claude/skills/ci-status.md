---
name: ci-status
description: Check latest CI run status, show pass/fail per job
user_invocable: true
---

# CI Status

Check the latest CI run and report job-level results.

## Arguments

- No args: latest run on current branch
- `<branch>`: latest run on specified branch
- `<run-id>`: specific run

## Process

### 1. Find the Run

```bash
gh run list --branch <branch> --limit 1 --json databaseId,status,conclusion,name,createdAt
```

### 2. Get Job Details

```bash
gh run view <id> --json jobs --jq '.jobs[] | "\(.name): \(.status) \(.conclusion)"'
```

### 3. Report

Show a table:

| Job | Status |
|-----|--------|
| Typecheck | success/failure |
| Build | success/failure |
| Test | success/failure |
| E2E (react) | success/failure |
| ... | ... |

If any job failed, fetch its logs:

```bash
gh run view --job=<job-id> --log-failed
```

Show the last 20 lines of the failing log.
