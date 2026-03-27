# Test Expansion Plan — 1,000 New Tests

## Why

The framework has 3,606 tests but they're mostly happy-path unit tests. What's missing:
- **Real-world failure modes** — what happens when Redis dies mid-request, when a migration has a typo, when a user sends a 50MB JSON body
- **DX validation** — do the CLI generators actually produce working code, do error messages make sense, does the scaffolder output boot
- **Integration trust** — can you actually chain Router → Middleware → Controller → ORM → Response without something silently breaking
- **Edge cases that ship bugs** — unicode in slugs, concurrent transactions, session fixation, CSRF token rotation

---

## Current State

| Metric | Value |
|--------|-------|
| Tests | 3,606 |
| Files | 186 |
| Real failures locally | 0 |

### Coverage Gaps

**Completely untested (0 test files):**
- 12 health check classes
- 35 CLI commands
- 8 mail transport drivers
- 24 heartbeat dashboard pages
- 5 search engine drivers
- 5 OAuth controllers
- 5 core cache stores
- 3 session handlers
- 3 queue remote drivers
- 2 MongoDB drivers

**Tested but shallow (happy path only):**
- Auth — no session expiry, remember token rotation, concurrent login tests
- Queue — no job timeout, dead letter, backoff calculation verification
- Database — no connection pool exhaustion, transaction deadlock, large result sets
- Validation — no deeply nested wildcard expansion, async rule timeout
- Core HTTP — no malformed requests, huge payloads, slow clients

---

## Plan

### Wave 1: DX & Generators (300 tests)

*Does the framework help or hurt developers? Test the entire "new project" experience.*

#### 1A. CLI Make Generators — 150 tests

Every generator must produce code that actually compiles and follows conventions.

```
packages/cli/tests/unit/generators/
```

For each of the 19 Make* commands, test:
1. Creates file at correct path with correct name
2. Generated class extends the right base class
3. Generated code includes `override` keyword where needed (noImplicitOverride)
4. Flag combinations work (e.g. `make:model Post --migration --factory --seeder` creates 4 files)
5. Refuses to overwrite existing files
6. Handles edge cases: kebab-case input → PascalCase class, nested directories
7. Generated stub is valid TypeScript (no syntax errors)
8. Error message is helpful when directory doesn't exist

Key DX scenarios:
- `make:model User` when User already exists — clear error, not silent overwrite
- `make:controller API/UserController` — creates nested directory
- `make:migration create_posts_table` — timestamp prefix, correct schema stub
- `make:model Post -mfs` — shorthand flags create model + migration + factory + seeder

#### 1B. CLI Database Commands — 40 tests

Real SQLite migrations, not mocks.

```
packages/cli/tests/integration/
  migrate.test.ts           — run pending, skip if current, rollback, fresh, status table
  seed.test.ts              — run seeder, --class flag, seeder ordering
```

DX scenarios:
- `migrate` with no pending migrations — friendly message, exit 0
- `migrate:rollback` with nothing to roll back — friendly message
- `migrate:fresh` in production without `--force` — refuses with warning
- `migrate:status` — shows ran/pending in clear table format
- Migration file has syntax error — helpful error with file path and line

#### 1C. CLI Utility Commands — 30 tests

```
packages/cli/tests/unit/
  AboutCommand.test.ts      — shows runtime, env, packages, database info
  RouteListCommand.test.ts  — table format, --method filter, --path filter, colored methods
  KeyGenerateCommand.test.ts — generates valid base64 key, idempotent
  TinkerCommand.test.ts     — evaluates expressions, auto-imports models, handles errors
  CacheClearCommand.test.ts — clears configured stores
  DownCommand.test.ts       — creates maintenance file, UpCommand removes it
```

DX scenarios:
- `route:list` with no routes registered — empty state message
- `about` — shows actual Bun version, not hardcoded
- `key:generate` when .env doesn't exist — helpful error
- `tinker` with syntax error — shows error, doesn't crash REPL

#### 1D. Health Checks — 80 tests

Real checks against real (mocked) services, not just "returns true/false".

```
packages/health/tests/unit/
  DatabaseCheck.test.ts     — connect success, connect fail, slow query threshold, wrong credentials
  CacheCheck.test.ts        — read/write cycle works, driver not configured, store unreachable
  QueueCheck.test.ts        — can push, worker not running, queue backed up (size > threshold)
  MemoryCheck.test.ts       — under limit passes, over RSS limit fails, over heap limit fails
  StorageCheck.test.ts      — writable passes, read-only fs fails, disk full simulation
  EnvironmentCheck.test.ts  — all required vars set, missing required var, wrong type
  MailCheck.test.ts         — transport configured, transport unreachable
  AppCheck.test.ts          — key set, key missing, debug on in production warns
  AuthCheck.test.ts         — default guard configured, provider missing
  RouterCheck.test.ts       — routes registered, duplicate route detection
  SchedulerCheck.test.ts    — entries exist, invalid cron expression
  UptimeCheck.test.ts       — tracks uptime, threshold exceeded
```

DX scenario: `GET /health` returns structured JSON with each check's status, duration, and human-readable message. When something fails, the message tells you what to fix.

### Wave 2: Driver Reality (350 tests)

*Do the drivers actually work with their backends, or just look like they do?*

#### 2A. Mail Transports — 80 tests

```
packages/mail/tests/unit/
  ArrayTransport.test.ts    — stores messages, flush clears, multiple sends accumulate
  LogTransport.test.ts      — logs subject+to, handles HTML/text/empty bodies, no crash on huge body

packages/mail/tests/integration/
  SmtpTransport.test.ts     — real TCP handshake (mock server), EHLO, AUTH, DATA, QUIT sequence
                              error: server rejects AUTH → MailError with "authentication failed"
                              error: server unreachable → MailError with connection info
  ResendTransport.test.ts   — correct API payload shape, handles 422 validation error, rate limit 429
  SendGridTransport.test.ts — personalizations format, content array, 401 unauthorized → clear error
  MailgunTransport.test.ts  — multipart form data, EU endpoint (api.eu.mailgun.net), domain routing
  PostmarkTransport.test.ts — JSON payload, server token header, inactive recipient bounce handling
  SesTransport.test.ts      — AWS SigV4 signing, region in endpoint, raw MIME message format
```

DX scenarios:
- Send email with no `from` configured — error says "Set MAIL_FROM_ADDRESS in .env"
- Transport API returns 401 — error says "Invalid API key for Resend" not generic HTTP error
- SMTP server drops connection mid-send — doesn't hang forever, times out with message

#### 2B. Core Cache & Session Drivers — 80 tests

```
packages/core/tests/unit/
  MemoryCacheStore.test.ts     — get/put/forget/flush, TTL expiry, increment from 0, decrement below 0
  FileCacheStore.test.ts       — real temp files, serialization roundtrip, expired entry cleanup on get
  NullCacheStore.test.ts       — always returns null, has() always false, increment returns 0
  RedisCacheStore.test.ts      — mock ioredis, atomic increment, TTL via SETEX, connection lost recovery
  MemcachedCacheStore.test.ts  — mock memjs, get/set, flags, expiry

  MemorySessionHandler.test.ts — read/write/destroy, GC removes expired, concurrent sessions isolated
  FileSessionHandler.test.ts   — file per session, GC deletes by mtime, handles corrupt file gracefully
  CookieSessionHandler.test.ts — encrypts data, rejects tampered cookie, max cookie size enforcement
```

DX scenarios:
- Cache `get()` on expired key — returns null, not stale data
- File session with corrupt JSON — starts fresh session, doesn't crash
- Cookie session exceeds 4KB — throws with "Session data too large for cookie driver, use file or database"
- Redis connection lost — cache miss (graceful), not unhandled exception

#### 2C. Heartbeat Dashboard — 100 tests

Test that pages render correctly with data, empty states work, and the API returns proper JSON.

```
packages/heartbeat/tests/unit/
  DashboardController.test.ts  — 20 tests
    route dispatch: / → overview, /requests → requests, /queries → queries
    API: /api/entries returns JSON array, /api/entries?type=query filters
    API: /api/exception-groups/resolve sets resolved_at
    env gate: returns 403 in production
    unknown route: returns overview (not 404)

  pages/
    OverviewPage.test.ts       — stats computed from entries, charts have data points, empty DB → zeros
    RequestsPage.test.ts       — filter by method works, pagination math correct, empty → empty state
    RequestDetailPage.test.ts  — related entries grouped by type, waterfall items computed, missing entry → null
    QueriesPage.test.ts        — slow section filters correctly, N+1 section present, SQL highlighted
    ExceptionsPage.test.ts     — groups sorted by last_seen, resolve link has fingerprint
    PerformancePage.test.ts    — latency percentiles computed, top endpoints sorted by avg duration
    LogsPage.test.ts           — level filter works, level badge colors correct
    (+ 7 more pages, 3-5 tests each)

  shared/
    charts.test.ts             — sparkline/line/area/bar/ring produce valid SVG with viewBox
    components.test.ts         — pagination renders correct page count, sqlHighlight colors keywords
```

DX scenario: Developer visits `/_heartbeat/` with zero telemetry — sees helpful empty states ("No requests recorded yet. Visit your app to generate telemetry."), not broken charts or "undefined".

#### 2D. Search Engines — 90 tests

```
packages/search/tests/unit/
  CollectionEngine.test.ts     — 20 tests: where equals/contains, whereIn, orderBy asc/desc,
                                  paginate with correct total/lastPage, empty collection, keys()
  DatabaseEngine.test.ts       — 20 tests: LIKE query generation, pagination, ordering, no results

packages/search/tests/integration/
  MeilisearchEngine.test.ts    — 20 tests: createIndex, deleteIndex, index documents, search with
                                  filters, faceted search, update document, remove document
  TypesenseEngine.test.ts      — 15 tests: schema with field types, search, filter by facet,
                                  sort, delete collection
  ElasticsearchEngine.test.ts  — 15 tests: create mapping, index, search, filter, aggregation,
                                  delete index
```

DX scenarios:
- Search with typo in field name → helpful error, not cryptic engine response
- Index document with missing required field → validation error before API call
- Engine not reachable → "Meilisearch at http://localhost:7700 is not responding" not "fetch failed"

### Wave 3: Integration & Edge Cases (350 tests)

*What breaks when you actually use these packages together?*

#### 3A. OAuth — 80 tests

```
packages/oauth/tests/unit/
  AuthorizationController.test.ts  — 20 tests
    authorize: valid client → redirect with code
    authorize: PKCE challenge/verifier roundtrip
    authorize: invalid client_id → 404 with message
    authorize: mismatched redirect_uri → 400
    deny: user denies → redirect with error=access_denied

  TokenController.test.ts          — 20 tests
    authorization_code grant: valid code → access_token + refresh_token
    refresh_token grant: valid refresh → new tokens, old refresh revoked
    revoke: valid token → 200, token no longer works
    invalid grant_type → 400 with "unsupported_grant_type"
    expired code → 400 with "authorization_code_expired"

  ClientController.test.ts         — 20 tests
    create: name + redirect_uris → client_id + hashed secret
    update: change name, redirect URIs
    delete: soft delete, tokens revoked
    list: paginated, filtered by user

  ScopeController.test.ts          — 10 tests
    list: returns all registered scopes
    validate: known scope passes, unknown fails

  oauthRoutes.test.ts              — 10 tests
    all routes registered with correct methods
    middleware applied (auth on client routes, guest on authorize)
```

#### 3B. Queue Remote Drivers — 60 tests

```
packages/queue/tests/integration/
  RedisDriver.test.ts      — 20 tests (skip without Redis)
    push/pop FIFO, delayed jobs (ZADD), release with delay
    fail stores in failed set, retry moves back to queue
    size counts pending + delayed, clear removes all
    concurrent pop (two workers) — only one gets the job
    connection lost mid-operation — reconnects or throws clear error

  SqsDriver.test.ts        — 20 tests (skip without SQS/LocalStack)
    send/receive, visibility timeout, delete after process
    batch send (up to 10), FIFO queue ordering
    dead letter queue after max receives

  KafkaDriver.test.ts      — 20 tests (skip without Kafka)
    produce/consume, partition assignment
    consumer group rebalancing, offset commit
    deserialize failure → error handler, not crash
```

#### 3C. Social Auth — 60 tests

```
packages/social-auth/tests/unit/
  GoogleProvider.test.ts    — 10 tests: redirect URL params, token exchange, userinfo parsing, email scope
  GitHubProvider.test.ts    — 10 tests: redirect URL, token exchange, /user API, email API fallback
  FacebookProvider.test.ts  — 10 tests: redirect URL, token exchange, graph API fields
  TwitterProvider.test.ts   — 10 tests: OAuth 1.0a request token, authorize redirect, access token
  AppleProvider.test.ts     — 10 tests: JWT id_token parsing, nonce validation, name from first login only
  LinkedInProvider.test.ts  — 10 tests: OpenID Connect flow, profile projection, email retrieval
```

DX scenarios:
- Provider returns error (user denied) → redirects with flash message, not unhandled exception
- Token exchange fails (expired code) → clear error "Authorization code expired, please try again"
- API returns unexpected shape → graceful fallback, not "Cannot read property 'email' of undefined"

#### 3D. MongoDB — 40 tests

```
packages/database/tests/integration/
  mongo-connection.test.ts      — 20 tests (skip without MongoDB)
    connect, disconnect, reconnect
    insert, find by ID, find with filter
    update one, update many, upsert
    delete one, delete many
    aggregate pipeline, count, distinct

  mongo-query-builder.test.ts   — 20 tests
    where equals, where operator ($gt, $lt, $in)
    orderBy, limit, skip, projection
    nested document query (dot notation)
    array field queries ($elemMatch)
```

#### 3E. Real-World Edge Cases — 110 tests

These are the bugs that actually ship to production.

```
packages/core/tests/edge/
  http-edge-cases.test.ts        — 20 tests
    request with 10MB JSON body → 413 or handled gracefully
    request with invalid Content-Type → doesn't crash JSON parser
    request with duplicate headers → last value wins
    request with null bytes in path → rejected
    HEAD request returns headers but no body
    OPTIONS preflight with invalid origin → no CORS headers
    extremely long URL (8KB+) → 414 URI Too Long
    request during shutdown → 503 Service Unavailable
    concurrent requests to same session → no race condition
    response already sent, middleware tries to modify → no crash

  encryption-edge-cases.test.ts  — 10 tests
    decrypt with wrong key → DecryptException, not garbled output
    decrypt tampered ciphertext → DecryptException
    encrypt empty string → works, decrypts back to empty
    encrypt with missing APP_KEY → clear error message
    key rotation: encrypt with old, decrypt with new → fails with message

packages/database/tests/edge/
  query-edge-cases.test.ts       — 15 tests
    where with null value → IS NULL
    where with empty string → = ''
    where with boolean → = 1/0 (SQLite)
    orderBy with unicode column name → quoted correctly
    insert with all nullable fields as null → works
    select with 100+ columns → no query length issue
    transaction rollback on exception → clean state
    nested transactions (savepoints) → inner rollback doesn't affect outer

  concurrent.test.ts             — 10 tests
    parallel inserts to same table → all succeed
    parallel reads during write → no stale reads (WAL mode)
    connection pool exhaustion → queues, doesn't crash

packages/auth/tests/edge/
  security.test.ts               — 15 tests
    session fixation: ID changes after login
    remember token: rotated on each use
    password hash: timing-safe comparison
    CSRF token: changes per session, rejects stale tokens
    login throttle: 5 failed attempts → lockout event fired
    concurrent login from two tabs → both sessions valid
    logout from one device → other sessions survive (unless invalidateAll)

packages/validation/tests/edge/
  complex.test.ts                — 10 tests
    wildcard expansion: items.*.name with 1000 items → doesn't timeout
    required_if with nested dot-notation field
    confirmed rule: password_confirmation must match exactly
    unique rule with soft deletes (exclude trashed)
    custom rule that returns Promise<boolean> (async)
    error messages: placeholder replacement with attribute names
    bail: stops on first failure, doesn't run expensive DB rules

packages/queue/tests/edge/
  failure.test.ts                — 10 tests
    job throws after 2s → times out at configured timeout
    job exceeds maxAttempts → moved to failed, failed() hook called
    job with non-serializable data → clear error at dispatch time
    chain: 2nd job fails → 3rd never runs, catch handler called with context
    batch: cancel mid-processing → remaining jobs skipped

packages/filesystem/tests/edge/
  security.test.ts               — 10 tests
    path traversal: ../../etc/passwd → rejected
    symlink outside root → rejected
    filename with null byte → rejected
    filename with unicode → handled correctly
    put with empty content → creates empty file
    delete non-existent file → returns false, no crash
    directory listing with 10,000 files → returns all, doesn't OOM

packages/helpers/tests/edge/
  boundary.test.ts               — 10 tests
    Collection.chunk(0) → throws, not infinite loop
    Str.slug('') → returns ''
    Arr.get(null, 'key') → returns null
    Http.get with DNS failure → timeout, clear error message
    Duration.parse('invalid') → throws with input in message
    Result.try(() => { throw null }) → Err wraps null
    Collection.take(-5) on 3 items → returns last 3
    Num.format(Infinity) → returns 'Infinity', not crash
    match() with no arms and no otherwise → throws
    retry() with 0 attempts → runs callback once
```

---

## Summary

| Wave | Category | Tests | Focus |
|------|----------|-------|-------|
| 1 | CLI Generators | 150 | DX: generated code compiles, flags work, errors help |
| 1 | CLI DB + Utility | 70 | DX: commands produce correct output, handle edge cases |
| 1 | Health Checks | 80 | Real checks with failure scenarios |
| 2 | Mail Transports | 80 | API payload shapes, error messages, connection failures |
| 2 | Core Drivers | 80 | Cache/session with real files, expiry, corruption |
| 2 | Heartbeat Dashboard | 100 | Page rendering, empty states, API responses |
| 2 | Search Engines | 90 | Unit + integration with CI services |
| 3 | OAuth | 80 | Full grant flows, PKCE, token lifecycle |
| 3 | Queue Remote | 60 | Redis/SQS/Kafka with real connections |
| 3 | Social Auth | 60 | Provider flows, error handling |
| 3 | MongoDB | 40 | Connection + query builder |
| 3 | Edge Cases | 110 | Security, concurrency, unicode, huge payloads |
| | **Total** | **1,000** | |

## Execution

- **Wave 1** (300 tests): 4 parallel agents — no external services needed
- **Wave 2** (350 tests): 4 parallel agents — mock clients + createTestStore()
- **Wave 3** (350 tests): 4 parallel agents — CI services for integration

## Verification

```bash
bun test packages/*/tests/

# Target: 4,606+ total tests, 0 real failures
```
