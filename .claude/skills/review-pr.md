---
name: review-pr
description: Review a PR — fetch diff, run tests, check for common issues
user_invocable: true
---

# PR Review

Review a pull request for quality, correctness, and common issues.

## Arguments

Required: PR number (e.g., `23`) or URL

## Process

### 1. Fetch PR Info

```bash
gh pr view <number> --json title,body,files,additions,deletions,commits
gh pr diff <number>
```

### 2. Analyze Changes

For each changed file, check for:

- **Missing exports**: new classes/functions not exported from index.ts
- **Type errors**: run typecheck
- **Breaking changes**: removed exports, renamed public APIs, changed function signatures
- **Security**: hardcoded secrets, SQL injection, XSS, command injection
- **Convention violations**: missing `override` keyword, missing `| undefined` on optional properties
- **Test coverage**: new code without corresponding tests

### 3. Run Tests

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run typecheck
bun test packages/
```

### 4. Report

Format as:

```
## PR #<number>: <title>

### Summary
<1-2 sentence summary of what the PR does>

### Issues Found
- [ ] <issue description> (file:line)

### Tests
- Typecheck: pass/fail
- Unit tests: X pass, Y fail

### Verdict
APPROVE / REQUEST CHANGES / NEEDS DISCUSSION
```
