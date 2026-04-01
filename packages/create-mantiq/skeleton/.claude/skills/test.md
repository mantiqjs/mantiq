---
name: test
description: Run tests, typecheck, and report results
user_invocable: true
---

# Test Runner

Run the project test suite and report results clearly.

## Arguments

- No args: run all (typecheck + tests)
- `unit`: run only unit tests
- `feature`: run only feature tests
- `typecheck`: run only typecheck
- `<file>`: run a specific test file

## Step 1: TypeScript Typecheck

```bash
npx tsc --noEmit
```

Report any type errors with file:line.

## Step 2: Tests

```bash
bun test tests/
```

Or for specific suites:
```bash
bun test tests/unit/
bun test tests/feature/
bun test tests/feature/auth.test.ts
```

## Summary

Report a table:

| Check | Result |
|-------|--------|
| Typecheck | pass/fail (N errors) |
| Unit tests | N pass, N fail |
| Feature tests | N pass, N fail |

If all pass, say "All green." If any failures, list them with file:line and error message.
