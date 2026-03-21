# Technical Debt & Gaps

Priority: **P0** = blocking, **P1** = should fix soon, **P2** = nice to have

## Testing

- [x] ~~`@mantiq/mail`~~ → 7 files, 126 tests
- [x] ~~`create-mantiq`~~ → CI scaffold sanity (4 kits × 4 checks)
- [x] ~~`@mantiq/validation`~~ → +1 file, 46 tests (DB rules, FormRequest)
- [x] ~~`@mantiq/auth`~~ → +5 files, 99 tests (guards, middleware, token auth)
- [x] ~~`@mantiq/database`~~ → 72/71/72/70 tests across Postgres/MySQL/MSSQL/SQLite
- [x] ~~`@mantiq/search`~~ → 6 drivers tested against real services
- [x] ~~`@mantiq/core`~~ → +4 files, 114 tests
- [x] ~~`@mantiq/queue`~~ → +5 files, 81 tests
- [x] ~~`@mantiq/logging`~~ → +1 file, 20 tests
- [x] ~~`@mantiq/filesystem`~~ → +1 file, 49 tests
- [x] ~~`@mantiq/realtime`~~ → +2 files, 51 tests
- [x] ~~`@mantiq/events`~~ → +2 files, 74 tests
- [ ] **P2** `@mantiq/oauth` — needs integration tests (full auth code flow with PKCE)
- [ ] **P2** `@mantiq/social-auth` — needs provider response mocking tests
- [ ] **P2** `@mantiq/vite` — only 1 test file
- [ ] **P2** `@mantiq/heartbeat` — dashboard + widget tests

## TypeScript Strictness

- [ ] **P1** Typecheck set to `continue-on-error` in CI — fix type errors then enforce
- [ ] **P2** Core package type issues: private constructor, missing `override`, `Server` type

## Documentation

- [ ] **P1** Docs accuracy audit — verify code examples work against current API
- [ ] **P2** `@mantiq/oauth` + `@mantiq/social-auth` docs
- [ ] **P2** `@mantiq/heartbeat` docs — debug widget, mail watcher
- [ ] **P2** `@mantiq/search` docs — drivers, Searchable mixin
- [ ] **P2** `@mantiq/health` docs — checks, endpoint
- [ ] **P2** Deployment guide (Fly.io, Railway, VPS)
- [ ] **P2** API reference (auto-generated from source)

## Framework Features

- [x] ~~JWT auth guard~~ → Sanctum tokens in `@mantiq/auth`, JWT in `@mantiq/oauth`
- [x] ~~OAuth 2.0 server~~ → `@mantiq/oauth` with 4 grants, PKCE, scopes
- [x] ~~Social login~~ → `@mantiq/social-auth` with 8 providers
- [x] ~~Unified database layer~~ → SQL + MongoDB behind same API
- [x] ~~Full-text search~~ → `@mantiq/search` with 6 drivers
- [x] ~~Health checks~~ → `@mantiq/health` with 12 checks
- [x] ~~API JSON responses~~ → `/api/*` always returns JSON, even errors in debug mode
- [x] ~~Validation unique/exists~~ → DatabasePresenceVerifier auto-wired
- [ ] **P1** Rate limiting middleware
- [ ] **P2** Authorization — Gates & Policies
- [ ] **P2** 2FA / TOTP support
- [ ] **P2** Polymorphic relationships: `morphOne`, `morphMany`, `morphToMany`
- [ ] **P2** `hasOneThrough`, `hasManyThrough` relationships

## Starter Kits

- [x] ~~`/account` link broken~~ → fixed
- [x] ~~Search + health not in skeleton~~ → shipped
- [x] ~~Token auth not in skeleton~~ → PersonalAccessToken + migration + API guard
- [ ] **P2** SPA routing — Inertia-style (server-driven page resolution)
- [ ] **P2** Example apps (auth, admin, kitchen-sink tiers)

## DevEx

- [ ] **P1** Unified dev command — single `bun run dev` for backend + vite
- [ ] **P2** CHANGELOG.md — per-package changelogs
- [ ] **P2** Linting setup (biome or eslint)
- [ ] **P2** Contribution guide

## Infrastructure

- [x] ~~CI/CD pipeline~~ → 7 service containers, scaffold sanity, all tests
- [x] ~~Algolia secrets~~ → configured
- [ ] **P2** NPM_TOKEN for auto-publish
- [ ] **P2** Branch protection rules
- [ ] **P2** Automated version bumping (changesets)

## Published Packages (20)

| # | Package | Version | Description |
|---|---|---|---|
| 1 | `@mantiq/core` | 0.2.1 | Container, router, HTTP kernel, config, sessions, cache |
| 2 | `@mantiq/database` | 0.2.0 | Query builder, ORM, migrations (SQL + MongoDB) |
| 3 | `@mantiq/auth` | 0.2.1 | Session + token auth, guards, Sanctum tokens |
| 4 | `@mantiq/cli` | 0.1.6 | 18 generators, migrations, REPL |
| 5 | `@mantiq/validation` | 0.2.0 | 40+ rules, FormRequest, DatabasePresenceVerifier |
| 6 | `@mantiq/helpers` | 0.1.3 | Str, Arr, Num, Collection, HTTP client |
| 7 | `@mantiq/filesystem` | 0.1.3 | Local, S3, GCS, Azure, FTP, SFTP |
| 8 | `@mantiq/logging` | 0.1.3 | Console, file, daily, stack channels |
| 9 | `@mantiq/events` | 0.1.3 | Dispatcher, broadcasting, model observers |
| 10 | `@mantiq/queue` | 0.1.3 | Jobs, chains, batches, scheduling |
| 11 | `@mantiq/realtime` | 0.1.3 | WebSocket, SSE, pub/sub |
| 12 | `@mantiq/heartbeat` | 0.3.6 | APM dashboard, debug widget, mail watcher |
| 13 | `@mantiq/vite` | 0.1.3 | Vite integration, SSR |
| 14 | `@mantiq/mail` | 0.2.0 | 8 transports, markdown emails |
| 15 | `@mantiq/notify` | 0.2.1 | 13 notification channels |
| 16 | `@mantiq/search` | 0.1.0 | 6 search drivers (Algolia, Meili, Typesense, ES, DB, Collection) |
| 17 | `@mantiq/health` | 0.1.0 | 12 health checks, `/health` endpoint |
| 18 | `@mantiq/oauth` | 0.1.0 | OAuth 2.0 server, JWT, 4 grants, PKCE |
| 19 | `@mantiq/social-auth` | 0.1.0 | Social login, 8 providers, extensible |
| 20 | `create-mantiq` | 0.7.0 | Scaffold CLI, 4 kits (React/Vue/Svelte/API) |
