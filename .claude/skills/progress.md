---
name: progress
description: Analyse project progress — feature completeness, test coverage, package maturity
user_invocable: true
---

# Project Progress Report

Analyse the current state of MantiqJS and report on progress, completeness, and what's left.

## Process

### 1. Package Maturity

For each of the 20 packages, assess:

- **Code**: Read `src/index.ts` exports — how many classes/functions are exported?
- **Tests**: Count test files in `tests/` — unit + integration
- **Docs**: Does a spec exist in `specs/packages/<name>.md`?
- **Provider**: Is `mantiq.provider` set in package.json?

Rate each package: **Production** (tested, documented, stable API), **Beta** (working but gaps), **Stub** (minimal/placeholder)

### 2. Feature Completeness

Compare against Laravel feature set:

| Feature | Laravel | MantiqJS | Status |
|---------|---------|----------|--------|
| Routing | yes | yes | done/partial/missing |
| ORM | yes | yes | ... |
| Auth | yes | yes | ... |
| Queue | yes | yes | ... |
| ... | ... | ... | ... |

### 3. Test Coverage

```bash
# Count tests per package
for pkg in packages/*/tests; do
  echo "$(basename $(dirname $pkg)): $(find $pkg -name '*.test.ts' | wc -l) test files"
done
```

### 4. Skeleton/Stubs Health

- Do scaffolded apps work? (reference latest e2e results)
- How many config files? How many are documented?
- How minimal is the User model? index.ts?

### 5. DEBT.md Status

Read DEBT.md, summarize open items by priority.

### 6. Report

End with:
- Overall readiness score (0-100%)
- Top 5 blockers for 1.0
- Recommended next actions
