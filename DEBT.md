# Technical Debt & Gaps

Priority: **P1** = should fix soon, **P2** = nice to have

## Testing

- [ ] **P2** `@mantiq/oauth` — integration tests (full auth code flow with PKCE)
- [ ] **P2** `@mantiq/social-auth` — provider response mocking tests
- [ ] **P2** `@mantiq/vite` — only 1 test file
- [ ] **P2** `@mantiq/heartbeat` — dashboard + widget tests

## TypeScript Strictness

- [ ] **P1** Typecheck `continue-on-error` in CI — 848 errors (mostly tsconfig path cascading, not real bugs)

## Documentation

- [ ] **P1** Docs accuracy audit — verify code examples work against current API
- [ ] **P2** New package docs: oauth, social-auth, search, health
- [ ] **P2** Deployment guide (Fly.io, Railway, VPS)
- [ ] **P2** API reference (auto-generated from source)

## Framework Features

- [ ] **P2** Authorization — Gates & Policies
- [ ] **P2** 2FA / TOTP support
- [ ] **P2** Polymorphic relationships: `morphOne`, `morphMany`, `morphToMany`
- [ ] **P2** `hasOneThrough`, `hasManyThrough` relationships

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
| Rate limiting middleware | `ThrottleRequests` auto-registered via CoreServiceProvider |
| Unified dev command | `bun run dev` starts backend + vite concurrently |
| Vite 8 migration | Rolldown + Oxc, all plugins updated |
| JWT auth guard | Sanctum tokens in @mantiq/auth, JWT in @mantiq/oauth |
| OAuth 2.0 server | @mantiq/oauth with 4 grants, PKCE, scopes |
| Social login | @mantiq/social-auth with 8 providers |
| Unified database layer | SQL + MongoDB behind same API |
| Full-text search | @mantiq/search with 6 drivers |
| Health checks | @mantiq/health with 12 checks |
| API JSON responses | /api/* always returns JSON errors |
| Validation unique/exists | DatabasePresenceVerifier auto-wired |
| 643 integration tests | 10 packages, 7 CI service containers |
| CI/CD pipeline | Test, build, typecheck, 4 scaffold sanity checks |

## Published Packages (20)

| # | Package | Version | Description |
|---|---|---|---|
| 1 | `@mantiq/core` | 0.3.0 | Container, router, kernel, config, sessions, cache, rate limiting |
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
| 13 | `@mantiq/vite` | 0.2.0 | Vite 8 integration, SSR |
| 14 | `@mantiq/mail` | 0.2.0 | 8 transports, markdown emails |
| 15 | `@mantiq/notify` | 0.2.1 | 13 notification channels |
| 16 | `@mantiq/search` | 0.1.0 | 6 search drivers |
| 17 | `@mantiq/health` | 0.1.0 | 12 health checks |
| 18 | `@mantiq/oauth` | 0.1.0 | OAuth 2.0 server, JWT, PKCE |
| 19 | `@mantiq/social-auth` | 0.1.0 | Social login, 8 providers |
| 20 | `create-mantiq` | 0.9.0 | Scaffold CLI, Vite 8, 4 kits |
