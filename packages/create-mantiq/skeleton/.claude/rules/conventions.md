---
description: MantiqJS framework conventions — loaded every session
---

# MantiqJS Conventions

This is a MantiqJS project — a full-stack TypeScript web framework for Bun.

## Critical Rules

1. **Always use `override`** — `noImplicitOverride` is enabled. Every method that overrides a base class member MUST use the `override` keyword.

2. **Use `make:*` generators** — never manually create models, controllers, migrations, etc. Run `bun mantiq make:model Post --migration` instead.

3. **ESM only** — use `import`, never `require()`. Use `.ts` extensions in relative imports.

4. **Bun runtime** — use `bun test`, `bun run`, Bun APIs. Not Node.js, not jest, not vitest.

5. **Named exports** — controllers, models, middleware use named exports. Only migrations and seeders use `export default class`.

## Base Class Signatures

These are the most common mistakes. Get these right:

```
Factory.definition(index: number, fake: Faker)     — NOT (faker)
Middleware.handle(request, next)                    — next() takes NO arguments
Controller methods return Promise<Response>         — use MantiqResponse.json()
Command.handle(args: ParsedArgs): Promise<number>   — return 0 for success
FormRequest.rules(): Record<string, string>         — rule strings like 'required|email'
```

## File Placement

```
Controllers    → app/Http/Controllers/<Name>Controller.ts
Models         → app/Models/<Name>.ts
Middleware     → app/Http/Middleware/<Name>Middleware.ts
Form Requests  → app/Http/Requests/<Action><Name>Request.ts
Providers      → app/Providers/<Name>ServiceProvider.ts
Commands       → app/Console/Commands/<Name>Command.ts
Migrations     → database/migrations/<timestamp>_<name>.ts
Factories      → database/factories/<Name>Factory.ts
Seeders        → database/seeders/<Name>Seeder.ts
Feature tests  → tests/feature/<name>.test.ts
Unit tests     → tests/unit/<name>.test.ts
Config         → config/<name>.ts
Routes         → routes/web.ts, routes/api.ts
```

## Imports

```typescript
import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { Model } from '@mantiq/database'
import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'
import { Factory } from '@mantiq/database'
import type { Faker } from '@mantiq/database'
import { FormRequest } from '@mantiq/validation'
import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'
import { ServiceProvider } from '@mantiq/core'
import type { Middleware, NextFunction } from '@mantiq/core'
import { TestCase } from '@mantiq/testing'
```

## Common Commands

```bash
bun mantiq make:model <Name> [--migration] [--factory] [--seed]
bun mantiq make:controller <Name>
bun mantiq make:middleware <Name>
bun mantiq make:request <Name>
bun mantiq migrate
bun mantiq migrate:fresh
bun mantiq route:list
bun mantiq serve
bun test tests/
```
