# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mantiq is a full-stack TypeScript web framework for Bun (>=1.1.0). It follows Laravel-inspired conventions with a modular monorepo of 23 packages under `@mantiq/*`. All packages use ESM (`"type": "module"`) with TypeScript strict mode.

## Common Commands

```bash
# Development
bun install                          # Install all workspace deps
bun run dev                          # Start dev server
bun mantiq key:generate              # Generate encryption key

# Testing
bun run test                         # Run all unit tests
bun test packages/core/              # Run tests for a single package
bun run test:ci                      # CI variant (needs service containers)
bunx playwright test                 # E2E browser tests
bunx playwright test e2e/auth-flow.spec.ts  # Single E2E test

# Quality
bun run typecheck                    # TypeScript strict validation across all packages
bun run lint                         # Lint all packages
bun run build                        # Build all packages

# Database
bun mantiq migrate                   # Run migrations
bun mantiq seed                      # Seed database
bun mantiq schema:generate           # Generate TypeScript interfaces from DB schema

# Code generation
bun mantiq make:model Post --migration
bun mantiq make:controller PostController
bun mantiq make:middleware AuthMiddleware
```

## Architecture

### Monorepo Structure

Workspace root manages all packages. Internal deps use `workspace:*` protocol. Path aliases in `tsconfig.json` map `@mantiq/*` to `packages/*/src/index.ts`.

### Key Packages

- **core** — IoC container, router, middleware pipeline, HTTP kernel, config, encryption, hashing, cache, sessions
- **database** — Query builder, Eloquent-style ORM, migrations, seeders, factories (SQLite, Postgres, MySQL, MSSQL, MongoDB)
- **auth** — Session & token guards, user providers, authentication middleware
- **cli** — 40 generator/utility commands, command kernel, dev server
- **validation** — Rule engine (`required|email|min:8`), 40+ rules, FormRequest
- **helpers** — Str, Arr, Num, Collection classes, HTTP client, async utilities
- **create-mantiq** — Project scaffolder (`bun create mantiq`)

### Core Patterns

**Service Container**: IoC with `bind()`, `singleton()`, `transient()`. Constructor injection with auto-resolution. Service providers register via `boot()` and `register()` lifecycle methods. Auto-discovered via `"mantiq.provider"` in package.json.

**Routing**: Express-like syntax with parameter constraints (`whereNumber()`, `whereAlpha()`), route groups, resource routing, middleware grouping.

**Middleware Pipeline**: Stack-based `Pipeline` class. Built-in: `StartSession`, `VerifyCsrfToken`, `EncryptCookies`, `CorsMiddleware`, `TrimStringsMiddleware`.

**ORM**: Models with fillable, hidden, casts. Relations, eager loading, pagination, factories, observers.

**Validation**: `FormRequest` auto-validates before controller. Rule strings or custom rule classes.

### Testing

Tests use Bun's native test runner (`bun:test`) with `describe`/`it`/`expect`. Tests live in `packages/*/tests/` split into `unit/` and `integration/` directories. E2E tests use Playwright in `e2e/`.

### CI Pipeline

GitHub Actions runs: test (with Postgres, MySQL, MSSQL, Redis, Meilisearch, Elasticsearch, Typesense), typecheck, build, scaffold verification, and E2E (Playwright) jobs.

### Publishing

Manual workflow via `.github/workflows/publish.yml`. Supports dry-run and individual package selection. Uses `bun run version:set X.Y.Z` for version sync across all packages.
