---
name: test
description: Run typecheck, unit tests, and e2e tests with clear reporting
user_invocable: true
---

# MantiqJS Test Suite

Run the full test suite and report results. Follow each step in order.

## Arguments

- No args: run all (typecheck + unit + e2e)
- `unit`: run only unit tests
- `e2e`: run only e2e tests
- `typecheck`: run only typecheck

## Step 1: Typecheck

```bash
export PATH="$HOME/.bun/bin:$PATH" && bun run typecheck
```

Report any packages with type errors.

## Step 2: Unit Tests

```bash
export PATH="$HOME/.bun/bin:$PATH" && bun test packages/
```

**MSSQL failures are infrastructure-dependent** — ignore them. Report all other failures as real issues.

## Step 3: E2E Tests

```bash
export PATH="$HOME/.bun/bin:$PATH" && npx playwright test e2e/
```

Report any failures with the test name and error.

## Summary

Report a table:

| Suite | Pass | Fail | Skip |
|-------|------|------|------|

If all pass (ignoring MSSQL), say "All green." If any non-MSSQL failures, list them clearly.
