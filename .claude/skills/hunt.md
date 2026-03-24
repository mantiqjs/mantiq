---
name: hunt
description: Deep bug hunt — security vulnerabilities, broken features, anti-patterns, missing guards
user_invocable: true
---

# Bug Hunt

Systematically search the codebase for security vulnerabilities, broken features, anti-patterns, and missing safeguards. This is not a surface-level audit — dig into actual code paths.

## Arguments

- No args: full hunt (all categories)
- `security`: security-focused hunt
- `broken`: find broken/dead code paths
- `antipattern`: find anti-patterns and code smells
- `<package>`: hunt in a specific package (e.g., `core`, `auth`, `database`)

## Process

### 1. SQL Injection Hunt

Search every file in `packages/database/src/` for:
- String interpolation in SQL: `${variable}` inside SQL strings (not using `?` params)
- Raw queries with user input: `whereRaw`, `selectRaw`, `orderByRaw` with unescaped values
- Column names from user input passed to `where()`, `orderBy()`, `join()`
- Table names from user input

For each finding, trace the call chain: can user input reach this code path?

### 2. XSS Hunt

Search `packages/vite/src/`, `packages/heartbeat/src/`, and all `.stub` files for:
- `innerHTML` assignments without escaping
- Template literals that include user data in HTML context
- Response bodies built from unescaped user input
- Missing `escapeHtml()` calls on data embedded in HTML

### 3. Auth & Session Security

Check:
- Session fixation: is session ID regenerated after login? (check `SessionGuard.login()`)
- Password timing attacks: is password comparison constant-time? (check `HashManager.check()`)
- Token exposure: are tokens/passwords ever logged or included in error responses?
- Remember-me tokens: are they cryptographically random? How are they stored?
- OAuth: is state parameter validated? (check `AbstractProvider.user()`)
- JWT: is algorithm pinned? Can attacker switch to `none`? (check `@mantiq/oauth`)
- CSRF: can token be reused? Is it rotated on login?

### 4. Broken Code Paths

For each package, check:
- **Dead imports**: imported but never used
- **Unreachable code**: code after `throw`, `return`, or `process.exit()`
- **Missing error handling**: async functions without try/catch where failures are likely
- **Silent failures**: `catch {}` or `catch { /* ignore */ }` that hide real errors
- **Race conditions**: shared mutable state accessed from async code without locks
- **Memory leaks**: event listeners added but never removed, growing Maps/Sets
- **Broken method chains**: methods that return `void` instead of `this`

### 5. Anti-Patterns

Search for:
- **`as any` in framework code** (not tests, not stubs): count and categorize
- **God classes**: files >500 lines, classes with >20 methods
- **Circular dependencies**: package A imports B which imports A
- **Magic strings**: hardcoded config keys, route paths, or event names that should be constants
- **Mutable statics**: `static` properties modified at runtime (thread-safety risk)
- **Service locator abuse**: `app()`, `auth()`, `config()` called deep inside business logic instead of injecting
- **N+1 query setups**: code that queries inside a loop without eager loading
- **Sync I/O in async context**: `readFileSync`, `writeFileSync`, `execSync` in request handlers
- **Unchecked `.get()` on Maps**: calling `.get()` without null check
- **Loose equality**: `==` instead of `===` (except intentional null checks)

### 6. Missing Guards

Check for:
- **Missing input validation**: controller actions that read `request.input()` without FormRequest or manual validation
- **Missing auth middleware**: routes that access user data but don't have `auth` middleware
- **Missing rate limiting**: login/register routes without `throttle` middleware
- **Missing CORS on sensitive endpoints**: token/OAuth endpoints without CORS headers
- **Missing Content-Type checks**: endpoints that assume JSON but don't verify
- **Missing request size limits**: file upload endpoints without size validation
- **Missing pagination limits**: list endpoints where `per_page` can be set to 999999

### 7. Dependency Vulnerabilities

Check:
- `bun audit` or equivalent for known CVEs
- Outdated packages with security patches
- Packages importing from `/node_modules/` internals (breaks on updates)
- Optional peer deps that silently break features when missing

## Report Format

Group findings by severity:

```
## CRITICAL (exploit possible)
### [SEC-001] SQL injection in orderBy — user input reaches raw SQL
**File:** packages/database/src/query/Builder.ts:245
**Impact:** Full database compromise
**Trace:** request.query('sort') → controller → User.query().orderBy(sort) → raw SQL
**Fix:** Whitelist allowed column names or use sanitizeColumn()

## HIGH (data corruption or auth bypass possible)
### [BUG-001] ...

## MEDIUM (incorrect behavior, potential data loss)
### [BUG-002] ...

## LOW (code quality, minor issues)
### [ANTI-001] ...
```

For each finding include:
1. Unique ID (SEC/BUG/ANTI prefix + number)
2. One-line title
3. File path + line number
4. Impact description
5. Call trace (how user input reaches the vulnerability)
6. Suggested fix

## After the Hunt

1. Create GitHub issues for CRITICAL and HIGH findings
2. Add MEDIUM findings to DEBT.md
3. Log LOW findings as comments in the code
4. Report total counts per severity
