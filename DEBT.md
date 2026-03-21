# Technical Debt & Gaps

Priority: **P0** = blocking, **P1** = should fix soon, **P2** = nice to have

## Testing

- [x] ~~`@mantiq/mail` — 0 test files~~ → 7 files, 126 tests (unit + integration)
- [x] ~~`create-mantiq` — 0 test files~~ → CI scaffold sanity tests for all 4 kits (boots, /api/ping, X-Heartbeat)
- [x] ~~`@mantiq/validation` — only 2 test files~~ → +1 integration file, 46 tests (DB rules, FormRequest)
- [x] ~~`@mantiq/auth` — only 4 test files~~ → +4 files, 82 tests (auth flow, middleware, guards)
- [x] ~~`@mantiq/database` — Postgres/MySQL integration gaps~~ → 72/71 tests each, parity with SQLite/MSSQL
- [x] ~~`@mantiq/search` — 0 integration tests~~ → 6 drivers tested against real services (Meili, Typesense, ES, Algolia, SQLite, Collection)
- [x] ~~`@mantiq/core` — no integration tests~~ → +4 files, 114 tests (HTTP, routing, session, cache)
- [x] ~~`@mantiq/queue` — no integration tests~~ → +5 files, 81 tests (SQLite driver, worker, chains, batches, schedule)
- [x] ~~`@mantiq/logging` — no integration tests~~ → +1 file, 20 tests (file + daily drivers)
- [x] ~~`@mantiq/filesystem` — no integration tests~~ → +1 file, 49 tests (local driver, manager)
- [x] ~~`@mantiq/realtime` — no integration tests~~ → +2 files, 51 tests (channels, SSE)
- [x] ~~`@mantiq/events` — no integration tests~~ → +2 files, 74 tests (model events, dispatcher lifecycle)
- [ ] **P2** `@mantiq/vite` — only 1 test file
- [ ] **P2** `@mantiq/heartbeat` — dashboard + widget tests

## TypeScript Strictness

- [ ] **P1** Typecheck currently set to `continue-on-error` in CI — several packages have type errors that need fixing before enforcing
- [ ] **P2** Core package has type issues: private constructor assignability, missing `override` modifiers, `Server` type not found

## Documentation

- [ ] **P1** Docs accuracy audit — verify all code examples actually work against current API
- [ ] **P2** `@mantiq/heartbeat` docs — debug widget, mail watcher, dashboard pages
- [ ] **P2** `@mantiq/search` docs — drivers, Searchable mixin, config
- [ ] **P2** `@mantiq/health` docs — built-in checks, custom checks, endpoint
- [ ] **P2** Deployment guide (Fly.io, Railway, VPS)
- [ ] **P2** API reference (auto-generated from source)

## Framework Features

- [ ] **P1** JWT auth guard — token-based auth for API routes
- [ ] **P1** Rate limiting middleware
- [x] ~~Unified database layer~~ → QueryBuilder + Model work across SQL and MongoDB with same API
- [x] ~~Full-text search~~ → `@mantiq/search` with 6 drivers
- [x] ~~Health checks~~ → `@mantiq/health` with 12 built-in checks
- [ ] **P2** Authorization — Gates & Policies
- [ ] **P2** 2FA / TOTP support
- [ ] **P2** CSRF middleware
- [ ] **P2** CORS middleware (configurable)
- [ ] **P2** Laravel-style relationships: `hasOneThrough`, `hasManyThrough`, `morphOne`, `morphMany`, `morphToMany`

## Starter Kits

- [x] ~~`/account` link broken~~ → fixed to `/account/profile`
- [x] ~~Search + health not in skeleton~~ → shipped in `create-mantiq@0.6.0`
- [ ] **P2** SPA routing should be Inertia-style (server tells client which page to render, no hardcoded route list)
- [ ] **P2** Example apps (auth, admin, kitchen-sink tiers beyond the base starter)

## DevEx

- [ ] **P1** Unified dev command — single `bun run dev` starts backend + vite HMR
- [ ] **P2** CHANGELOG.md — per-package changelogs
- [ ] **P2** Linting setup (biome or eslint)
- [ ] **P2** Contribution guide

## Infrastructure

- [x] ~~CI/CD pipeline~~ → GitHub Actions with test, build, typecheck, scaffold sanity
- [x] ~~Database services in CI~~ → Postgres 17, MySQL 8, MSSQL 2022
- [x] ~~Search services in CI~~ → Meilisearch, Typesense 26, Elasticsearch 8.17
- [x] ~~Redis + Mailpit in CI~~ → added for queue and mail integration tests
- [x] ~~Algolia secrets~~ → `ALGOLIA_APP_ID` + `ALGOLIA_API_KEY` configured
- [x] ~~NPM_TOKEN secret~~ → needs adding for auto-publish (manual publish works)
- [ ] **P2** Branch protection rules on master (require CI pass, require PR review)
- [ ] **P2** Automated version bumping (changesets or similar)
- [ ] **P2** Auto-publish on merge to master
