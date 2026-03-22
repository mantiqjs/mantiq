# Technical Debt & Gaps

Priority: **P1** = should fix soon, **P2** = nice to have

## DevEx Helpers (P1)

- [ ] **P1** Global helpers: `dd()`, `dump()`, `env()`, `config()`, `app()`
- [ ] **P1** Path helpers: `app_path()`, `base_path()`, `storage_path()`, `config_path()`, `database_path()`
- [ ] **P1** Console output helpers: colorized dump, table output, progress bars

## Testing

- [ ] **P1** Auth e2e flow: register → login → protected route → logout → session expiry
- [ ] **P1** Middleware header assertions: CORS, CSRF token, session cookie flags, security headers
- [ ] **P1** SSR rendering tests (dev via ssrLoadModule, prod via bundle import)
- [ ] **P1** Equalize e2e coverage across kits (Vue/Svelte missing heartbeat, content-type, header scoping tests)
- [ ] **P2** Error state browser tests: 404 page, error boundaries, failed API calls, CSRF expiry
- [ ] **P2** Heartbeat e2e with real database (widget injection, panel toggle, SPA stat updates)
- [ ] **P2** Queue/Jobs integration: dispatch → worker process → completion flow
- [ ] **P2** WebSocket/Realtime e2e tests
- [ ] **P2** CLI generator verification: generated migration runs, generated model queries
- [ ] **P2** Performance baseline: response times, memory under sustained traffic, connection pool

## Documentation

- [ ] **P1** Docs accuracy audit — verify code examples work against current API
- [ ] **P2** New package docs: oauth, social-auth, search, health
- [ ] **P2** Deployment guide (Fly.io, Railway, VPS)
- [ ] **P2** API reference (auto-generated from source)

## Framework Features

- [ ] **P2** 2FA / TOTP support
- [ ] **P2** Polymorphic relationships: `morphOne`, `morphMany`, `morphToMany`
- [ ] **P2** `hasOneThrough`, `hasManyThrough` relationships

## @mantiq/panel — Admin Panel (Filament-like)

Server-driven admin panel using React + shadcn/ui. Define Resources in TypeScript, get full CRUD UI with zero frontend code. Server sends JSON schema, React renders it.

### Core (P2 — post-1.0)
- [ ] `Panel` config builder (path, guard, brand, theme, discovery)
- [ ] `PanelServiceProvider` base class (route registration, middleware, resource discovery)
- [ ] `Resource` base class (model binding, table/form/filter/action definitions)
- [ ] `Page` base class (dashboard, custom pages)
- [ ] JSON protocol: server describes UI schema, frontend renders generically

### Table System
- [ ] Column types: Text, Boolean, Image, Badge, Date, Icon, Color
- [ ] Sorting, search, pagination (server-driven)
- [ ] Filters: Select, Date range, Trashed, custom
- [ ] Bulk actions with confirmation dialogs
- [ ] Row actions (edit, delete, custom)
- [ ] Column toggling, reordering

### Form System
- [ ] Field types: TextInput, Select, Toggle, DatePicker, FileUpload, RichEditor, Repeater
- [ ] `RelationSelect` — auto-populates from belongsTo/hasMany
- [ ] Validation integration with `@mantiq/validation`
- [ ] Create / Edit / View modes from same definition
- [ ] Form sections, tabs, grid layout

### Widgets & Dashboard
- [ ] `StatsWidget` — stat cards with trends
- [ ] `ChartWidget` — line, bar, pie (lightweight charting lib)
- [ ] `TableWidget` — mini table widget
- [ ] Dashboard grid layout, widget discovery

### Frontend (pre-built React + shadcn)
- [ ] `PanelLayout` — sidebar + topbar shell
- [ ] `ResourceTable` — data table (shadcn table + column renderers)
- [ ] `ResourceForm` — dynamic form renderer from schema
- [ ] Generic column/field component map (server type → React component)
- [ ] Dark mode, responsive, theme customization

### Auth & Navigation
- [ ] Dedicated admin guard (reuses `@mantiq/auth`)
- [ ] Auto-generated sidebar navigation from discovered resources
- [ ] Navigation groups, icons, badges, ordering
- [ ] User menu (profile, logout)

### CLI
- [ ] `make:resource` — generates Resource class for a model
- [ ] `make:panel-page` — generates custom page
- [ ] `make:widget` — generates dashboard widget

## Starter Kits

- [ ] **P2** SPA routing — Inertia-style (server-driven page resolution)
- [ ] **P2** Example apps (auth, admin, kitchen-sink tiers)

## DevEx

- [ ] **P2** CHANGELOG.md — per-package changelogs
- [ ] **P2** Linting setup (biome or eslint)
- [ ] **P2** Contribution guide

## Infrastructure

- [ ] **P2** NPM_TOKEN for auto-publish on merge
- [ ] **P2** Branch protection rules
- [ ] **P2** Automated version bumping (changesets)

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
| Vite 8 migration | Rolldown + Oxc, all plugins updated |
| 865 → 0 type errors | Typecheck enforced in CI |
| 2600+ tests | 320 Tier 1 tests, 643 integration tests, full CI |
| Playwright e2e | 30 browser tests across 4 starter kits (api, react, vue, svelte) |
| Static asset 404 fix | ViteServiceProvider auto-discovered via mantiq.provider field |
| Heartbeat SPA updates | X-Heartbeat scoped to HTML + SPA, clean API responses |
| OAuth 2.0 server | @mantiq/oauth with 4 grants, PKCE, scopes, JWT |
| Social login | @mantiq/social-auth with 8 providers |
| Sanctum tokens | PersonalAccessToken, TokenGuard, HasApiTokens |
| Unified database | SQL + MongoDB behind same QueryBuilder/Model API |
| Full-text search | @mantiq/search with 6 drivers |
| Health checks | @mantiq/health with 12 checks |
| API JSON responses | /api/* always returns JSON errors |

## Published Packages (20)

| # | Package | Latest | Next | Description |
|---|---|---|---|---|
| 1 | `@mantiq/core` | 0.3.0 | 0.4.0-rc.3 | Container, router, kernel, discovery, rate limiting |
| 2 | `@mantiq/database` | 0.2.0 | 0.3.0-rc.2 | Query builder, ORM, migrations (SQL + MongoDB) |
| 3 | `@mantiq/auth` | 0.3.0 | 0.4.0-rc.2 | Session + token auth, Gates & Policies |
| 4 | `@mantiq/cli` | 0.1.6 | 0.2.0-rc.2 | 19 generators, command auto-registration |
| 5 | `@mantiq/validation` | 0.2.0 | 0.3.0-rc.2 | 40+ rules, DatabasePresenceVerifier |
| 6 | `@mantiq/helpers` | 0.1.3 | 0.2.0-rc.2 | Str, Arr, Num, Collection, HTTP client |
| 7 | `@mantiq/filesystem` | 0.1.3 | 0.2.0-rc.2 | Local, S3, GCS, Azure, FTP, SFTP |
| 8 | `@mantiq/logging` | 0.1.3 | 0.2.0-rc.2 | Console, file, daily, stack channels |
| 9 | `@mantiq/events` | 0.1.3 | 0.2.0-rc.2 | Dispatcher, broadcasting, model observers |
| 10 | `@mantiq/queue` | 0.1.3 | 0.2.0-rc.2 | Jobs, chains, batches, scheduling |
| 11 | `@mantiq/realtime` | 0.1.3 | 0.2.0-rc.2 | WebSocket, SSE, pub/sub |
| 12 | `@mantiq/heartbeat` | 0.3.6 | 0.4.0-rc.2 | APM dashboard, debug widget |
| 13 | `@mantiq/vite` | 0.2.0 | 0.3.0-rc.2 | Vite 8 integration, SSR |
| 14 | `@mantiq/mail` | 0.2.0 | 0.3.0-rc.2 | 8 transports, markdown emails |
| 15 | `@mantiq/notify` | 0.2.1 | 0.3.0-rc.2 | 13 notification channels |
| 16 | `@mantiq/search` | 0.1.0 | 0.2.0-rc.2 | 6 search drivers |
| 17 | `@mantiq/health` | 0.1.0 | 0.2.0-rc.2 | 12 health checks |
| 18 | `@mantiq/oauth` | 0.1.0 | 0.2.0-rc.2 | OAuth 2.0 server, JWT, PKCE |
| 19 | `@mantiq/social-auth` | 0.1.0 | 0.2.0-rc.2 | Social login, 8 providers |
| 20 | `create-mantiq` | 0.9.0 | 1.0.0-rc.4 | Skeleton-based scaffold, 4 kits |
