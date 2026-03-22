---
name: audit
description: Analyse the project for improvements — code quality, security, performance, DX
user_invocable: true
---

# Project Audit

Perform a comprehensive analysis of the MantiqJS codebase and report actionable improvements.

## Arguments

- No args: full audit (all categories)
- `security`: security-focused audit
- `performance`: performance-focused audit
- `dx`: developer experience audit
- `deps`: dependency audit
- `<package>`: audit a specific package (e.g., `core`, `auth`)

## Categories

### 1. Security Audit

Scan for:
- Hardcoded secrets, API keys, tokens in source
- SQL injection vectors (raw queries without parameterization)
- XSS in HTML rendering (unescaped user input in templates)
- CSRF misconfigurations
- Missing auth middleware on sensitive routes
- Weak encryption/hashing defaults
- Insecure cookie settings (missing Secure, HttpOnly, SameSite)
- Path traversal in file operations
- Command injection in Bash/exec calls

### 2. Performance Audit

Check for:
- N+1 query patterns in models/controllers
- Missing database indexes (scan migration files)
- Large synchronous operations that should be queued
- Unbounded queries (no LIMIT)
- Memory leaks (event listeners not cleaned up, growing caches)
- Bundle size issues (unnecessary imports, missing tree-shaking)
- Missing caching opportunities

### 3. Code Quality

Check for:
- Dead code (unused exports, unreachable branches)
- Duplicate logic across packages
- Missing error handling (empty catch blocks)
- Inconsistent naming conventions
- `any` type usage that could be properly typed
- Missing `override` keyword
- Functions longer than 50 lines
- Files longer than 500 lines

### 4. Developer Experience

Check for:
- Missing or stale documentation
- Confusing API surfaces (too many params, unclear naming)
- Boilerplate that could be eliminated
- Missing helpful error messages
- Silent failures that should warn
- Config options without documentation

### 5. Dependency Audit

```bash
bun outdated 2>/dev/null || true
```

Check for:
- Outdated dependencies
- Unused dependencies (in package.json but never imported)
- Missing peer dependency declarations
- Circular dependencies between packages

## Report Format

For each finding:
```
### [SEVERITY] Category: Description

**File:** path/to/file.ts:line
**Issue:** What's wrong
**Fix:** How to fix it
**Impact:** What happens if not fixed
```

Severity: CRITICAL, HIGH, MEDIUM, LOW

End with a summary table:

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Security | 0 | 1 | 2 | 0 |
| ... | ... | ... | ... | ... |
