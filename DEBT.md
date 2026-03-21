# Technical Debt & Gaps

Priority: **P0** = blocking, **P1** = should fix soon, **P2** = nice to have

## Testing

- [ ] **P1** `@mantiq/mail` — 0 test files. Need unit tests for all 8 transports, Mailable, MarkdownRenderer, PendingMail, MailFake
- [ ] **P1** `create-mantiq` — 0 test files. Need scaffold output verification (API-only, React, Vue, Svelte)
- [ ] **P2** `@mantiq/validation` — only 2 test files, 40+ rules need coverage
- [ ] **P2** `@mantiq/auth` — only 4 test files, need guard/provider/middleware coverage
- [ ] **P2** `@mantiq/vite` — only 1 test file

## TypeScript Strictness

- [ ] **P1** Typecheck currently set to `continue-on-error` in CI — several packages have type errors that need fixing before enforcing
- [ ] **P2** Core package has type issues: private constructor assignability, missing `override` modifiers, `Server` type not found

## Documentation

- [ ] **P1** Docs accuracy audit — verify all code examples actually work against current API
- [ ] **P2** `@mantiq/heartbeat` docs — debug widget, mail watcher, dashboard pages
- [ ] **P2** Deployment guide (Fly.io, Railway, VPS)
- [ ] **P2** API reference (auto-generated from source)

## Framework Features

- [ ] **P1** JWT auth guard — token-based auth for API routes
- [ ] **P1** Rate limiting middleware
- [ ] **P2** Authorization — Gates & Policies
- [ ] **P2** 2FA / TOTP support
- [ ] **P2** CSRF middleware
- [ ] **P2** CORS middleware (configurable)

## Starter Kits

- [ ] **P2** SPA routing should be Inertia-style (server tells client which page to render, no hardcoded route list)
- [ ] **P2** Example apps (auth, admin, kitchen-sink tiers beyond the base starter)

## DevEx

- [ ] **P1** Unified dev command — single `bun run dev` starts backend + vite HMR
- [ ] **P2** CHANGELOG.md — per-package changelogs
- [ ] **P2** Linting setup (biome or eslint)
- [ ] **P2** Contribution guide

## Infrastructure

- [ ] **P1** Add `NPM_TOKEN` secret to GitHub repo for publish workflow
- [ ] **P2** Branch protection rules on master (require CI pass, require PR review)
- [ ] **P2** Automated version bumping (changesets or similar)
