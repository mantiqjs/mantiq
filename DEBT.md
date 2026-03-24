# Technical Debt & Gaps

Priority: **P0** = critical / blocks 1.0, **P1** = important / should fix soon, **P2** = nice to have

**Current rating: 6.5/10** — strong foundation, not production-ready yet.

---

## Type Safety (P0) — MOSTLY DONE

- [x] ~~Remove `as any` from all generated stubs (18→0 in framework code)~~
- [x] ~~Fix ORM return types: ModelQueryBuilder returns `T[]` and `T | null`~~
- [x] ~~Fix `auth().login(user)` — Authenticatable expanded with getAttribute/toObject/getKey~~
- [x] ~~AuthenticatableModel mixin constrained to ModelLike — no internal casts~~
- [ ] **P1** Fix `request.input()` return type — should be generic `request.input<T>()` not `Record<string, any>`
- [ ] **P1** Audit remaining `as any` in internal framework code (~70 in packages/core, database, auth)

## Error Visibility (P0 — silent failures are dangerous)

- [ ] **P0** Provider boot failures must log with stack trace (not just "[Mantiq] skipped")
- [ ] **P0** Deferred provider boot is fire-and-forget async — errors swallowed at Application.ts:300
- [ ] **P0** Route loading failures should always log (even outside debug mode)
- [ ] **P0** EncryptCookies silent fallback (line 51) — if decryption fails, log a warning instead of silently returning encrypted value
- [ ] **P1** Add structured error codes to all framework errors (not just string messages)

## Validation in Stubs (P0) — COMPLETED

- [x] ~~FormRequest auto-validation in route tuples: `[Controller, 'method', RegisterRequest]`~~
- [x] ~~Separate request classes: RegisterRequest, LoginRequest, StoreUserRequest, UpdateUserRequest~~
- [x] ~~HttpKernel auto-resolves FormRequest, validates, passes data to controller~~
- [x] ~~Controllers receive `(request, data)` — no manual validate() calls~~

## Security (P0)

- [ ] **P0** Security headers middleware — X-Frame-Options, Content-Security-Policy, X-Content-Type-Options, Strict-Transport-Security
- [ ] **P1** Cookie size validation — prevent >4KB session payloads silently failing
- [ ] **P1** Request timeout middleware — prevent slow requests from blocking the server
- [ ] **P2** Trust proxies middleware — X-Forwarded-* header handling

## Scaffold & Environment (P0) — COMPLETED

- [x] ~~`.env` template expanded to 30+ vars grouped by section~~
- [x] ~~`key:generate` CLI command~~
- [x] ~~`routes/console.ts` in skeleton~~
- [x] ~~`routes/channels.ts` in skeleton~~
- [x] ~~`storage/cache/` directory with .gitkeep~~
- [x] ~~`bootstrap/` directory with .gitkeep~~
- [x] ~~`.gitkeep` in `app/Console/Commands/`~~

## CLI Commands (P1)

- [x] ~~`down`, `up` — maintenance mode~~
- [x] ~~`config:cache`, `config:clear` — config caching for production~~
- [x] ~~`cache:clear` — cache management~~
- [x] ~~`storage:link` — symlink storage/app/public → public/storage~~
- [ ] **P1** `schedule:run` — scheduled task runner
- [ ] **P1** `queue:work`, `queue:failed`, `queue:retry` — queue worker commands
- [ ] **P2** `optimize` — cache config + routes + views
- [ ] **P2** `env:encrypt`, `env:decrypt` — encrypted .env for deployment

## Production Hardening (P1)

- [ ] **P1** Graceful shutdown hooks — drain queue workers, close DB connections on SIGTERM
- [ ] **P1** Request correlation IDs — trace requests across services via X-Request-ID header
- [ ] **P1** Structured logging integration — wire logging to HTTP kernel (request ID, duration, status)
- [ ] **P1** Database transaction helpers in Model and migrations
- [ ] **P1** Middleware dedup bug — `new Set()` collapses `auth:admin` and `auth:user` to one entry
- [ ] **P2** Database connection pooling visibility
- [ ] **P2** Cache warming/preload

## Middleware (P1)

- [x] ~~`auth` and `guest` middleware aliases — auto-registered by AuthServiceProvider~~
- [ ] **P1** Security headers middleware (see Security section above)
- [ ] **P2** Verified email middleware alias

## Stubs / Generators (P1)

- [ ] **P1** FormRequest stub — validation logic template
- [ ] **P1** Event + Listener stubs — event system templates
- [ ] **P1** Job stub — queue job template
- [ ] **P1** Notification stub — notification class template
- [ ] **P1** Mailable stub — email template
- [ ] **P2** Policy stub — authorization policy template
- [ ] **P2** Observer stub — model observer template
- [ ] **P2** Custom Command stub — console command template
- [ ] **P2** Exception stub — custom exception template
- [ ] **P2** Migration stub — blank migration template
- [ ] **P2** API Resource/Transformer stub

## Testing (P1)

- [x] ~~Auth e2e flow: register → login → protected → logout~~
- [x] ~~CRUD e2e: create, read, search, pagination, sort, update, delete~~
- [ ] **P1** Middleware header assertions: CORS, CSRF token, session cookie flags, security headers
- [ ] **P1** 8 packages lack integration tests: cli, create-mantiq, health, helpers, heartbeat, notify, social-auth, vite
- [ ] **P1** 5 packages have < 5 tests total: create-mantiq(34), social-auth(2), vite(2), health(1), validation(3)
- [ ] **P1** SSR rendering tests (dev via ssrLoadModule, prod via bundle import)
- [ ] **P1** Equalize e2e coverage across kits (Vue/Svelte thinner than React)
- [ ] **P2** Error state browser tests: 404 page, error boundaries, CSRF expiry
- [ ] **P2** Heartbeat e2e with real database
- [ ] **P2** Queue/Jobs integration: dispatch → worker → completion
- [ ] **P2** WebSocket/Realtime e2e tests
- [ ] **P2** CLI generator verification: generated files actually work
- [ ] **P2** Performance baseline: response times, memory under load

## @mantiq/testing Gaps (P1)

Package exists with TestCase, TestClient, TestResponse (18 unit tests). Compared against Laravel — 73% coverage.

### JSON Assertions (P1 — most impactful gap)
- [ ] **P1** `assertJsonPath('data.users.0.name', 'Ali')` — dot-notation path access
- [ ] **P1** `assertJsonCount(3, 'data.users')` — count items at path
- [ ] **P1** `assertJsonStructure(['data' => ['id', 'name']])` — validate shape
- [ ] **P1** `assertJsonMissing({ key: 'value' })` — assert JSON doesn't contain subset
- [ ] **P2** `assertSeeInOrder(['first', 'second'])` — ordered text assertions

### Auth Assertions (P1)
- [ ] **P1** Complete `actingAs(user, 'web')` — session auth (currently only token auth works)
- [ ] **P1** `assertAuthenticated(guard?)` — verify user is logged in
- [ ] **P1** `assertGuest(guard?)` — verify no user is logged in
- [ ] **P1** `assertAuthenticatedAs(user)` — verify specific user

### Database Assertions (P1)
- [ ] **P1** `assertSoftDeleted(table, data)` / `assertNotSoftDeleted()`
- [ ] **P1** `assertModelExists(model)` / `assertModelMissing(model)`
- [ ] **P2** `expectsDatabaseQueryCount(n)` — assert number of queries executed
- [ ] **P2** `DatabaseTransactions` trait — wrap each test in a transaction + rollback

### Session & Validation Assertions (P1)
- [ ] **P1** `assertSessionHas(key, value?)` / `assertSessionMissing(key)`
- [ ] **P1** `assertSessionHasErrors(keys?)` — check validation errors in session
- [ ] **P1** `assertValid()` / `assertInvalid(keys?)` — validation pass/fail
- [ ] **P2** `assertDownload(filename?)` — assert response is a file download

### TestCase Lifecycle (P1)
- [ ] **P1** `withoutMiddleware(Middleware)` — disable specific middleware for test
- [ ] **P1** `withoutExceptionHandling()` — let exceptions throw instead of returning 500
- [ ] **P2** `freezeTime()` / `travelTo(date)` — time manipulation for expiry/schedule tests
- [ ] **P2** `withSession(data)` / `withCookie(name, value)` — preset session/cookie state

### Fake Re-exports (P1 — already built in other packages)
- [ ] **P1** Re-export `EventFake` from @mantiq/events
- [ ] **P1** Re-export `QueueFake` from @mantiq/queue
- [ ] **P1** Re-export `MailFake` from @mantiq/mail
- [ ] **P1** Re-export `NotificationFake` from @mantiq/notify
- [ ] **P1** Re-export `HttpFake` from @mantiq/helpers
- [ ] **P2** Re-export `SearchFake`, `RealtimeFake`, `HeartbeatFake`

### Missing Features (P2)
- [ ] **P2** File upload testing — `withFile()`, `UploadedFile.fake()`
- [ ] **P2** Console command testing — `artisan('command')`, `assertExitCode`, `expectsOutput`
- [ ] **P2** `from(url)` — set referer header
- [ ] **P2** `withBasicAuth(user, pass)`
- [ ] **P2** `followRedirects()` — auto-follow 3xx
- [ ] **P2** `dump()` / `dd()` on TestResponse — debug helpers
- [ ] **P2** `assertServerError()` (5xx) / `assertClientError()` (4xx)
- [ ] **P2** `assertCookieExpired(name)`

## Architecture Cleanup (P1)

- [ ] **P1** Clarify `app()` vs `Application.getInstance()` — document canonical pattern
- [ ] **P1** Clarify `config()` helper vs `ConfigRepository` — when to use which
- [ ] **P1** Service locator pattern in controllers (`auth()`, `vite()`) — consider DI instead
- [ ] **P2** Model static vs instance method naming audit (create/save/fill consistency)

## DevEx Helpers (P1)

- [x] ~~Example `AppServiceProvider` in skeleton~~
- [ ] **P1** Console output helpers: colorized dump, table output, progress bars
- [ ] **P2** Example custom middleware in `app/Http/Middleware/`

## Documentation (P1)

- [ ] **P1** Docs accuracy audit — verify code examples work against current API
- [ ] **P2** New package docs: oauth, social-auth, search, health
- [ ] **P2** Deployment guide (Fly.io, Railway, VPS)
- [ ] **P2** API reference (auto-generated from source)

## Framework Features (P2)

- [ ] **P2** 2FA / TOTP support
- [ ] **P2** Polymorphic relationships: `morphOne`, `morphMany`, `morphToMany`
- [ ] **P2** `hasOneThrough`, `hasManyThrough` relationships

## Magic Classes & Helpers (P2)

Utility classes for common async/concurrency patterns — inspired by Laravel Pipeline, Process, Concurrency.

### Parallel & Concurrency
- [ ] **P1** `Parallel.run([fn1, fn2, fn3])` — run async tasks concurrently, collect all results (like `Promise.all` with error handling + timeouts)
- [ ] **P1** `Batch.of(items).chunk(50).process(fn)` — process large collections in parallel chunks with progress tracking
- [ ] **P2** `Semaphore.of(5).acquire(() => work())` — limit concurrent access to a resource (e.g., max 5 DB connections)
- [ ] **P2** `Defer.after(() => sendEmail())` — schedule work to run after the HTTP response is sent

### Resilience
- [ ] **P1** `Retry.times(3).backoff('exponential').run(fn)` — auto-retry with configurable backoff (constant, linear, exponential)
- [ ] **P1** `CircuitBreaker` — fail-fast after N failures, auto-recover after cooldown. For external APIs, payment gateways, etc.
- [ ] **P2** `Timeout.after(5000).run(fn)` — abort if function doesn't resolve within deadline
- [ ] **P2** `Fallback.try(primary).catch(secondary).catch(tertiary)` — cascading fallbacks

### Shell & Process
- [ ] **P1** `Process.run('command').timeout(30).env({}).cwd('/path')` — fluent shell execution with output capture, timeouts, error handling
- [ ] **P2** `Process.pipe('cat file | grep pattern | wc -l')` — piped commands
- [ ] **P2** `Process.pool(5).run(commands)` — run multiple shell commands in parallel with concurrency limit

### Functional Composition
- [ ] **P2** `Tap` / `Pipe` — value.pipe(trim).pipe(lowercase).pipe(slugify)
- [ ] **P2** `Lazy` — generator-based collection for memory-efficient processing of huge datasets: `Lazy.from(cursor).filter().map().chunk(100).each()`
- [ ] **P2** `Conditionable` mixin — `query.when(search, q => q.where('name', 'LIKE', search))` (Laravel's `when()`)

### Feature Flags
- [ ] **P2** `Feature.active('new-dashboard')` — toggle features without deploy, backed by DB/env/config
- [ ] **P2** `Feature.for(user).active('beta-ui')` — user-scoped feature flags with percentage rollouts

## @mantiq/panel — Admin Panel (P2 — post-1.0)

Server-driven admin panel using React + shadcn/ui. Define Resources in TypeScript, get full CRUD UI with zero frontend code.

### Core
- [ ] `Panel` config builder, `PanelServiceProvider`, `Resource` base class, `Page` base class
- [ ] JSON protocol: server describes UI schema, frontend renders generically

### Table System
- [ ] Column types: Text, Boolean, Image, Badge, Date, Icon, Color
- [ ] Sorting, search, pagination, filters, bulk actions, row actions

### Form System
- [ ] Field types: TextInput, Select, Toggle, DatePicker, FileUpload, RichEditor, Repeater
- [ ] RelationSelect, validation integration, create/edit/view modes

### Widgets & Dashboard
- [ ] StatsWidget, ChartWidget, TableWidget, dashboard grid layout

### Frontend
- [ ] PanelLayout, ResourceTable, ResourceForm (pre-built React + shadcn)

### CLI
- [ ] `make:resource`, `make:panel-page`, `make:widget`

## Starter Kits (P2)

- [ ] **P2** SPA routing — Inertia-style (server-driven page resolution)
- [ ] **P2** Example apps (auth, admin, kitchen-sink tiers)

## Infrastructure (P2)

- [ ] **P2** NPM_TOKEN for auto-publish on merge
- [ ] **P2** Branch protection rules
- [ ] **P2** Automated version bumping (changesets)
- [ ] **P2** CHANGELOG.md — per-package changelogs
- [ ] **P2** Linting setup (biome or eslint)
- [ ] **P2** Contribution guide

---

## Completed

| Item | Resolution |
|---|---|
| Auto-discovery | Providers discovered from package.json `mantiq.provider` field |
| Skeleton-based scaffolding | create-mantiq copies skeleton/ + overlays deltas |
| .env loading | Moved into Application.create() — no user code needed |
| Command auto-registration | 38 built-in commands, providers register their own |
| Middleware auto-registration | Each provider registers its own aliases in boot() |
| Middleware groups | web (stateful) + api (configurable per kit) auto-applied by route file |
| Gates & Policies | GateManager, Policy, Authorize middleware, Authorizable mixin |
| 19 CLI generators | make:model/controller/migration/job/mail/notification/policy/... |
| 6 utility commands | key:generate, down/up, cache:clear, config:cache/clear, storage:link |
| Rate limiting | ThrottleRequests auto-registered via CoreServiceProvider |
| Unified dev command | `bun run dev` starts backend + vite concurrently |
| Vite 8 + hot file | Rolldown + Oxc, mantiq-hot plugin writes public/hot for dev mode |
| 865 → 0 type errors | Typecheck enforced in CI |
| 3200+ tests | Unit + integration + 64 e2e browser tests across 4 kits |
| CSRF protection | EncryptCookies URL-decode fix, middleware groups (web/api) |
| Static asset serving | ViteServiceProvider auto-discovered, ServeStaticFiles middleware |
| Heartbeat APM | Dedicated SQLite, 10 watchers, dashboard at /_heartbeat |
| OAuth 2.0 server | @mantiq/oauth with 4 grants, PKCE, scopes, JWT |
| Social login | @mantiq/social-auth with 8 providers |
| Sanctum tokens | PersonalAccessToken, TokenGuard, HasApiTokens, AuthenticatableModel mixin |
| Unified database | SQL + MongoDB behind same QueryBuilder/Model API |
| Auto-pluralized tables | User → users, BlogPost → blog_posts (convention over config) |
| Full-text search | @mantiq/search with 6 drivers |
| Health checks | @mantiq/health with 12 checks |
| Boilerplate reduction | User model 28→7 lines, routes 119→19 lines, hash()/abort()/json() helpers |
| 16 config files | All with Laravel-style comment blocks, including broadcasting |
| CORS smart defaults | Auto-derived from APP_URL, credentials + allowed headers |
| 14 CLI skills | /publish, /test, /audit, /progress, /compare-laravel, etc. |
| Skeleton dedup | Root skeleton/ is symlink to packages/create-mantiq/skeleton/ |
| Stateful SPA API | SPA kits use session-based api group, clean route separation |
| Type safety P0 | 18→0 as-any in stubs, ModelQueryBuilder returns T[], Authenticatable expanded |
| FormRequest in stubs | Auto-validated via route tuple `[Controller, 'method', Request]` |
| config/vite.ts | reactRefresh + SSR config per kit, skeleton has documented defaults |
| Vite lazy hot file | Re-checks hot file on request — parallel startup safe |
| @mantiq/testing | TestCase, TestClient, TestResponse — 18 unit tests, 73% Laravel parity |
| Playground app | playground/react-app with workspace:* linking for local testing |

## Published Packages (21) — v0.5.19

All packages at unified version 0.5.19 on `latest` tag.

| # | Package | Description |
|---|---------|-------------|
| 1 | `@mantiq/core` | Container, router, kernel, middleware, discovery, helpers |
| 2 | `@mantiq/database` | Query builder, ORM, migrations (SQLite, Postgres, MySQL, MSSQL, MongoDB) |
| 3 | `@mantiq/auth` | Session + token auth, Gates & Policies, AuthenticatableModel |
| 4 | `@mantiq/cli` | 38 commands, 19 generators, command auto-registration |
| 5 | `@mantiq/validation` | 40+ rules, FormRequest, DatabasePresenceVerifier |
| 6 | `@mantiq/helpers` | Str, Arr, Num, Collection, HTTP client, HttpFake |
| 7 | `@mantiq/filesystem` | Local, S3, GCS, R2, Azure, FTP, SFTP |
| 8 | `@mantiq/logging` | Console, file, daily, stack channels |
| 9 | `@mantiq/events` | Dispatcher, broadcasting, model observers, EventFake |
| 10 | `@mantiq/queue` | Jobs, chains, batches, scheduling, QueueFake |
| 11 | `@mantiq/realtime` | WebSocket, SSE, presence channels, pub/sub, RealtimeFake |
| 12 | `@mantiq/heartbeat` | APM dashboard, debug widget, dedicated SQLite telemetry |
| 13 | `@mantiq/vite` | Vite 8, HMR, SSR, hot file dev mode, React Refresh |
| 14 | `@mantiq/mail` | 8 transports, markdown emails, MailFake |
| 15 | `@mantiq/notify` | 12 notification channels, NotificationFake |
| 16 | `@mantiq/search` | 6 search drivers, SearchFake |
| 17 | `@mantiq/health` | 12 health checks |
| 18 | `@mantiq/oauth` | OAuth 2.0 server, JWT, PKCE, 4 grants |
| 19 | `@mantiq/social-auth` | Social login, 8 providers |
| 20 | `@mantiq/testing` | TestCase, TestClient, TestResponse, DB + auth assertions |
| 21 | `create-mantiq` | Skeleton scaffold, 4 kits (React, Vue, Svelte, API-only) |
