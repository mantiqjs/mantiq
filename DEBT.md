# Technical Debt & Gaps

Priority: **P0** = critical / blocks users, **P1** = important / should fix soon, **P2** = nice to have

---

## Scaffold & Environment (P0)

- [x] ~~`.env` template expanded to 30+ vars grouped by section~~
- [x] ~~`key:generate` CLI command~~
- [x] ~~`routes/console.ts` in skeleton~~
- [x] ~~`routes/channels.ts` in skeleton~~
- [x] ~~`storage/cache/` directory with .gitkeep~~
- [x] ~~`bootstrap/` directory with .gitkeep~~
- [x] ~~`.gitkeep` in `app/Console/Commands/`~~

## CLI Commands (P1)

- [ ] **P1** `schedule:run` — scheduled task runner
- [ ] **P1** `queue:work`, `queue:failed`, `queue:retry` — queue worker commands
- [ ] **P1** `down`, `up` — maintenance mode
- [ ] **P1** `config:cache`, `config:clear` — config caching for production
- [ ] **P1** `cache:clear`, `cache:forget` — cache management
- [ ] **P1** `storage:link` — symlink storage/app/public → public/storage
- [ ] **P2** `optimize` — cache config + routes + views
- [ ] **P2** `env:encrypt`, `env:decrypt` — encrypted .env for deployment

## Middleware (P1)

- [ ] **P1** Register `auth` and `guest` middleware aliases in CoreServiceProvider (exist in @mantiq/auth but not auto-aliased)
- [ ] **P1** Security headers middleware — X-Frame-Options, Content-Security-Policy, X-Content-Type-Options
- [ ] **P2** Trust proxies middleware — X-Forwarded-* header handling
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

- [ ] **P1** Auth e2e flow: register → login → protected route → logout → session expiry
- [ ] **P1** Middleware header assertions: CORS, CSRF token, session cookie flags, security headers
- [ ] **P1** 8 packages lack integration tests: cli, create-mantiq, health, helpers, heartbeat, notify, social-auth, vite
- [ ] **P1** 5 packages have < 5 tests total: create-mantiq(1), social-auth(2), vite(2), health(1), validation(3)
- [ ] **P1** SSR rendering tests (dev via ssrLoadModule, prod via bundle import)
- [ ] **P1** Equalize e2e coverage across kits (Vue/Svelte thinner than React)
- [ ] **P2** Error state browser tests: 404 page, error boundaries, CSRF expiry
- [ ] **P2** Heartbeat e2e with real database
- [ ] **P2** Queue/Jobs integration: dispatch → worker → completion
- [ ] **P2** WebSocket/Realtime e2e tests
- [ ] **P2** CLI generator verification: generated files actually work
- [ ] **P2** Performance baseline: response times, memory under load

## DevEx Helpers (P1)

- [ ] **P1** Console output helpers: colorized dump, table output, progress bars
- [ ] **P1** Example `AppServiceProvider` in skeleton — starting point for custom providers
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
| Command auto-registration | Kernel registers all 33 builtins, providers register their own |
| Middleware auto-registration | Each provider registers its own aliases in boot() |
| Gates & Policies | GateManager, Policy, Authorize middleware, Authorizable mixin |
| 19 CLI generators | make:model/controller/migration/job/mail/notification/policy/... |
| Rate limiting | ThrottleRequests auto-registered via CoreServiceProvider |
| Unified dev command | `bun run dev` starts backend + vite concurrently |
| Vite 8 + hot file | Rolldown + Oxc, mantiq-hot plugin writes public/hot for dev mode |
| 865 → 0 type errors | Typecheck enforced in CI |
| 3200+ tests | Unit + integration + 44 e2e browser tests across 4 kits |
| CSRF protection | EncryptCookies URL-decode fix, middleware groups (web/api) |
| Static asset serving | ViteServiceProvider auto-discovered, ServeStaticFiles middleware |
| Heartbeat SPA updates | X-Heartbeat scoped to HTML + SPA, clean API responses |
| OAuth 2.0 server | @mantiq/oauth with 4 grants, PKCE, scopes, JWT |
| Social login | @mantiq/social-auth with 8 providers |
| Sanctum tokens | PersonalAccessToken, TokenGuard, HasApiTokens, AuthenticatableModel mixin |
| Unified database | SQL + MongoDB behind same QueryBuilder/Model API |
| Auto-pluralized tables | User → users, BlogPost → blog_posts (convention over config) |
| Full-text search | @mantiq/search with 6 drivers |
| Health checks | @mantiq/health with 12 checks |
| API JSON responses | /api/* always returns JSON errors |
| Boilerplate reduction | User model 28→7 lines, routes 119→19 lines, hash()/abort()/json() helpers |
| 16 config files | All with Laravel-style comment blocks, including broadcasting |
| CORS smart defaults | Auto-derived from APP_URL, credentials + allowed headers |
| 14 CLI skills | /publish, /test, /audit, /progress, /compare-laravel, etc. |
| Skeleton dedup | Root skeleton/ is symlink to packages/create-mantiq/skeleton/ |

## Published Packages (20) — v0.5.12

All packages at unified version 0.5.12 on `latest` tag.

| # | Package | Description |
|---|---------|-------------|
| 1 | `@mantiq/core` | Container, router, kernel, middleware, discovery, helpers |
| 2 | `@mantiq/database` | Query builder, ORM, migrations (SQLite, Postgres, MySQL, MSSQL, MongoDB) |
| 3 | `@mantiq/auth` | Session + token auth, Gates & Policies, AuthenticatableModel |
| 4 | `@mantiq/cli` | 31 commands, 19 generators, command auto-registration |
| 5 | `@mantiq/validation` | 40+ rules, FormRequest, DatabasePresenceVerifier |
| 6 | `@mantiq/helpers` | Str, Arr, Num, Collection, HTTP client |
| 7 | `@mantiq/filesystem` | Local, S3, GCS, R2, Azure, FTP, SFTP |
| 8 | `@mantiq/logging` | Console, file, daily, stack channels |
| 9 | `@mantiq/events` | Dispatcher, broadcasting, model observers |
| 10 | `@mantiq/queue` | Jobs, chains, batches, scheduling |
| 11 | `@mantiq/realtime` | WebSocket, SSE, presence channels, pub/sub |
| 12 | `@mantiq/heartbeat` | APM dashboard, debug widget, telemetry |
| 13 | `@mantiq/vite` | Vite 8, HMR, SSR, hot file dev mode |
| 14 | `@mantiq/mail` | 8 transports, markdown emails |
| 15 | `@mantiq/notify` | 12 notification channels |
| 16 | `@mantiq/search` | 6 search drivers (Algolia, Meilisearch, Typesense, ES, DB, collection) |
| 17 | `@mantiq/health` | 12 health checks |
| 18 | `@mantiq/oauth` | OAuth 2.0 server, JWT, PKCE, 4 grants |
| 19 | `@mantiq/social-auth` | Social login, 8 providers |
| 20 | `create-mantiq` | Skeleton scaffold, 4 kits (React, Vue, Svelte, API-only) |
