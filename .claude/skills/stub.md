---
name: stub
description: Generate a new stub file (controller, model, migration, seeder, middleware)
user_invocable: true
---

# Stub Generator

Generate a new file following MantiqJS conventions.

## Arguments

Format: `<type> <Name>` — e.g., `controller UserController`, `model Post`, `migration create_posts_table`

Supported types: `controller`, `model`, `migration`, `seeder`, `factory`, `middleware`, `provider`, `command`, `request`

## Process

### 1. Determine Location

| Type | Directory | Naming |
|------|-----------|--------|
| controller | app/Http/Controllers/ | `<Name>Controller.ts` |
| model | app/Models/ | `<Name>.ts` |
| migration | database/migrations/ | `<NNN>_<name>.ts` (auto-increment) |
| seeder | database/seeders/ | `<Name>Seeder.ts` |
| factory | database/factories/ | `<Name>Factory.ts` |
| middleware | app/Http/Middleware/ | `<Name>.ts` |
| provider | app/Providers/ | `<Name>ServiceProvider.ts` |
| command | app/Console/Commands/ | `<Name>Command.ts` |
| request | app/Http/Requests/ | `<Name>Request.ts` |

### 2. Generate Using Conventions

- Use `override` keyword on all overridden methods
- Use framework helpers (`json`, `abort`, `hash`) not raw classes
- Import from `@mantiq/*` packages
- Models: extend `AuthenticatableModel(Model)` if auth-related, otherwise just `Model`
- Migrations: use `SchemaBuilder`, include `up()` and `down()`
- Controllers: use typed `MantiqRequest`, return `Response`

### 3. For Migrations

Auto-detect the next migration number by scanning `database/migrations/` for existing files.

### 4. Report

Show the generated file path and contents.
