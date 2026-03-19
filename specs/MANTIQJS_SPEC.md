# MantiqJS — Development Specification

> **"The logical framework for Bun"**
>
> A Laravel-inspired, batteries-included web framework built natively for the Bun runtime. MantiqJS brings convention-over-configuration, elegant APIs, and zero decision fatigue to the TypeScript ecosystem.

---

## 1. Vision & Philosophy

### 1.1 Core Thesis

Developers who love TypeScript and Bun's performance should not have to sacrifice the productivity and developer experience that Laravel provides. MantiqJS bridges that gap — not as a direct port of Laravel, but as a framework that captures Laravel's philosophy while being fully idiomatic to Bun and TypeScript.

### 1.2 Guiding Principles

- **Zero decision fatigue.** Every architectural decision is made for the developer. Where do files go? How do I validate input? How does auth work? MantiqJS has one clear, documented answer for everything.
- **Convention over configuration.** Sensible defaults that work out of the box. SQLite with zero config in dev. Sessions just work. Auth is one command away.
- **Backend-focused.** MantiqJS is a backend framework. The frontend is the developer's choice (React, Vue, Svelte, or vanilla), connected through the Inertia protocol.
- **Bun-native.** Built on Bun's native APIs — HTTP server, SQLite, file system, test runner, package manager. No Node.js compatibility layers or polyfills.
- **Type-safe by default.** TypeScript is not optional. The framework leverages the type system to provide better DX than string-based PHP conventions — typed config, typed DI, typed route parameters.
- **Progressively complex.** A new developer can scaffold a project and be productive in five minutes. Advanced developers can swap drivers, extend the container, and build custom providers without fighting the framework.

### 1.3 Target Audience

- Laravel developers who want to move to TypeScript/Bun
- Node.js/Bun developers tired of stitching together 15 packages
- Full-stack developers who want Rails/Laravel productivity in the JS ecosystem
- Teams who value convention and consistency over "choose your own adventure"

---

## 2. Brand & Identity

| Property        | Value                          |
|-----------------|--------------------------------|
| Name            | MantiqJS                       |
| Meaning         | "Mantiq" (منطق) — Logic, reason. Rooted in the Islamic golden age of philosophy and science. |
| Domain          | mantiqjs.com                   |
| npm scope       | `@mantiq/*`                    |
| GitHub org      | github.com/mantiqjs            |
| CLI command     | `mantiq`                       |
| Tagline         | "The logical framework for Bun" |

---

## 3. Architecture Overview

### 3.1 Layered Architecture

```
┌──────────────────────────────────────────────────────┐
│                Developer Application                  │
│  (Controllers, Models, Jobs, Commands, Channels, etc.)│
├──────────────────────────────────────────────────────┤
│               @mantiq/core (the glue)                 │
│  Container · Router · Middleware · Config              │
│  HTTP Kernel · WS Kernel · Exception Handler           │
├──────────┬──────────┬──────────┬─────────────────────┤
│ @mantiq/ │ @mantiq/ │ @mantiq/ │ @mantiq/            │
│ database │ auth     │ inertia  │ queue · mail · cache │
│          │          │          │ realtime · events    │
├──────────┴──────────┴──────────┴─────────────────────┤
│                  Bun Runtime APIs                      │
│  Bun.serve · WebSocket · bun:sqlite · Bun.file        │
└──────────────────────────────────────────────────────┘
```

### 3.2 Package Ecosystem

| Package             | Purpose                                      | Priority  |
|---------------------|----------------------------------------------|-----------|
| `@mantiq/core`      | Service container, router, middleware, HTTP kernel, config, exception handler | Critical  |
| `@mantiq/database`  | Query builder, ORM, migrations, seeders      | Critical  |
| `@mantiq/vite`      | Vite+ dev server, SSR, universal routing     | Critical  |
| `@mantiq/auth`      | Session & token auth, guards, providers      | Critical  |
| `@mantiq/cli`       | Command runner, code generators, dev server   | Critical  |
| `@mantiq/queue`     | Job dispatching, workers, retry logic        | Secondary |
| `@mantiq/mail`      | Mail transports, message builder             | Secondary |
| `@mantiq/events`    | Event dispatcher, listeners                  | Secondary |
| `@mantiq/validation`| Rule engine, form requests                   | Critical  |
| `@mantiq/realtime`  | WebSocket, SSE, channels, broadcasting       | Secondary |
| `@mantiq/logging`   | Channel-based logging                        | Secondary |
| `@mantiq/helpers`   | Str, Arr, Num, Collection utilities          | Critical  |
| `@mantiq/media`     | Image/file processing, transformations, storage | Addon  |
| `@mantiq/ai`        | Multi-provider AI client, embeddings, completions | Addon  |
| `@mantiq/agents`    | AI agent framework, tools, chains, memory    | Addon     |
| `@mantiq/search`     | Full-text search driver abstraction          | Addon     |
| `@mantiq/socialise` | OAuth social authentication (Google, GitHub, etc.) | Addon |
| `@mantiq/cashier`   | Subscription billing (Stripe, LemonSqueezy)  | Addon     |
| `@mantiq/notify`    | Multi-channel notifications (email, SMS, push, Slack) | Addon |

### 3.3 Monorepo Structure

```
mantiqjs/
├── packages/
│   ├── core/
│   ├── database/
│   ├── inertia/
│   ├── vite/
│   ├── auth/
│   ├── cli/
│   ├── queue/
│   ├── cache/
│   ├── mail/
│   ├── events/
│   ├── realtime/
│   ├── validation/
│   ├── logging/
│   └── helpers/
├── addons/
│   ├── media/
│   ├── ai/
│   ├── agents/
│   ├── scout/
│   ├── socialite/
│   ├── cashier/
│   └── notify/
├── starters/
│   ├── react/
│   ├── vue/
│   ├── svelte/
│   └── vanilla/
├── docs/
├── tests/
├── package.json
├── bunfig.toml
└── README.md
```

---

## 4. Application Directory Structure

When a developer scaffolds a new MantiqJS project, they get this structure:

```
my-app/
├── app/
│   ├── Console/
│   │   └── Commands/
│   ├── Exceptions/
│   │   └── Handler.ts
│   ├── Http/
│   │   ├── Controllers/
│   │   ├── Middleware/
│   │   └── Requests/
│   ├── Models/
│   ├── Jobs/
│   ├── Events/
│   ├── Listeners/
│   ├── Providers/
│   │   ├── AppServiceProvider.ts
│   │   └── RouteServiceProvider.ts
│   ├── Services/
│   └── Channels/
├── bootstrap/
│   ├── app.ts
│   └── providers.ts
├── config/
│   ├── app.ts
│   ├── auth.ts
│   ├── cors.ts
│   ├── database.ts
│   ├── inertia.ts
│   ├── mail.ts
│   ├── queue.ts
│   ├── cache.ts
│   └── session.ts
├── database/
│   ├── factories/
│   ├── migrations/
│   └── seeders/
├── public/
│   └── index.ts
├── resources/
│   ├── css/
│   └── js/              ← frontend entry point (React/Vue/Svelte)
│       ├── app.tsx
│       ├── Pages/
│       └── Components/
├── routes/
│   ├── web.ts
│   ├── api.ts
│   ├── channels.ts
│   └── console.ts
├── storage/
│   ├── app/
│   ├── framework/
│   │   ├── cache/
│   │   └── sessions/
│   └── logs/
├── tests/
│   ├── Feature/
│   └── Unit/
├── .env
├── .env.example
├── bunfig.toml
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 5. Package Specifications

### 5.1 @mantiq/core — The Glue

The core package owns the application lifecycle and provides the foundation every other package builds on.

#### 5.1.1 Service Container

The dependency injection container is the spine of the framework. Every service, controller, and module registers and resolves through it.

**Requirements:**

- Typed bindings using TypeScript generics and interfaces (no string keys as primary API)
- Support for singletons, transient bindings, and factory functions
- Constructor injection via parameter type resolution
- Interface-to-implementation binding (contracts pattern)
- Contextual binding — resolve different implementations based on the consuming class
- Auto-resolution of classes with typed constructors
- Service provider registration with `register()` and `boot()` lifecycle hooks

**API Surface (target):**

```typescript
container.bind<UserRepository>(UserRepository, EloquentUserRepository)
container.singleton<CacheDriver>(CacheDriver, RedisCacheDriver)
container.make<UserRepository>(UserRepository)
```

#### 5.1.2 Configuration

**Requirements:**

- Load `.env` via Bun's native `process.env`
- Typed config files in `config/*.ts` that export plain objects
- Dot-notation accessor: `config('database.connections.default')`
- Environment helper: `env('DB_HOST', 'localhost')` with fallback defaults
- Config caching for production (serialize resolved config to a single file)
- Typed config inference — accessing `config('database')` returns the correct type

#### 5.1.3 HTTP Kernel

**Requirements:**

- Wraps `Bun.serve()` with a structured request lifecycle
- Request object with helpers: `request.input('name')`, `request.header('Authorization')`, `request.file('avatar')`, `request.cookie('session')`, `request.method()`, `request.path()`, `request.query()`
- Response builder: `response.json()`, `response.redirect()`, `response.status()`, `response.cookie()`, `response.header()`, `response.stream()` (for SSE)
- Built on web standard `Request`/`Response` where possible
- WebSocket upgrade detection and delegation to WebSocket kernel when `@mantiq/realtime` is installed
- Graceful shutdown handling (drain active connections, finish in-flight requests)
- Trusted proxy support

#### 5.1.3a WebSocket Kernel

The HTTP kernel must be architecturally ready for WebSocket support from day one, even if `@mantiq/realtime` is not installed. Bun's `Bun.serve()` handles both HTTP and WebSocket on the same port — the kernel needs to route upgrade requests to the realtime system when present.

**Requirements:**

- Detect WebSocket upgrade requests and delegate to the realtime package if registered
- If no realtime package is registered, reject upgrade requests with 426
- WebSocket lifecycle hooks integrated into the service container: `open`, `message`, `close`, `drain`
- Per-connection data (authenticated user, subscribed channels) attached to the WebSocket instance via Bun's native `ws.data`
- Middleware execution on WebSocket upgrade (authentication must happen before the connection is accepted)

#### 5.1.4 Router

**Requirements:**

- Route registration via `routes/web.ts` (session/Inertia middleware) and `routes/api.ts` (stateless middleware)
- HTTP method support: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`
- Route groups with shared prefix, middleware, and namespace
- Named routes: `route('users.show', { id: 1 })` → `/users/1`
- Resource routes: `router.resource('users', UserController)` generates standard CRUD routes
- Route parameters with type coercion: `/users/:id(number)`
- Route model binding: automatically resolve a model instance from a route parameter
- Wildcard and optional parameters
- Rate limiting per route or group
- Route caching for production

#### 5.1.5 Middleware Pipeline

**Requirements:**

- Ordered execution with before and after hooks
- Global middleware (applied to all requests)
- Route-level and group-level middleware
- Middleware aliases: `auth`, `guest`, `throttle`, `cors`
- Terminable middleware (runs after response is sent)
- Middleware parameters: `throttle:60,1`

**Built-in middleware:**

- CORS
- Session start
- Request body parsing
- CSRF protection (for web routes)
- Encrypted cookies
- Handle Inertia requests

#### 5.1.6 Exception Handler

**Requirements:**

- Centralized `app/Exceptions/Handler.ts` with `report()` and `render()` methods
- Dev mode: detailed HTML error page with stack trace, request dump, environment, route info
- Production mode: generic error pages, JSON for API routes
- Reportable/renderable exception classes
- Exception ignoring (don't report certain exception types)
- Integration with logging channels
- HTTP exception helpers: `abort(404)`, `abort(403, 'Forbidden')`

#### 5.1.7 Service Providers

**Requirements:**

- `register()` — bind services into the container (no dependencies resolved yet)
- `boot()` — run setup logic after all providers are registered (dependencies available)
- Deferred providers — only loaded when their bindings are actually needed
- Provider registration in `bootstrap/providers.ts`
- Framework providers load first, then application providers

---

### 5.2 @mantiq/database

#### 5.2.1 Connection Manager

**Requirements:**

- Default driver: Bun's native `bun:sqlite` (zero config)
- Additional drivers: PostgreSQL, MySQL (via native Bun TCP or compatible client libraries)
- Connection configuration in `config/database.ts`
- Multiple named connections
- Connection pooling for external databases
- Read/write splitting support
- Transaction support with callback API: `db.transaction(async (trx) => { ... })`

#### 5.2.2 Query Builder

**Requirements:**

- Fluent, chainable API
- Select, insert, update, delete, upsert
- Where clauses: `where`, `orWhere`, `whereIn`, `whereNull`, `whereBetween`, `whereExists`
- Joins: `join`, `leftJoin`, `rightJoin`, `crossJoin`
- Aggregates: `count`, `sum`, `avg`, `min`, `max`
- Ordering, grouping, limit, offset
- Subqueries
- Raw expressions for escape hatches
- Chunked results for large datasets
- Pagination: `paginate(perPage)` returns page metadata + data

**API Surface (target):**

```typescript
const users = await db.table('users')
  .where('active', true)
  .where('role', 'admin')
  .orderBy('created_at', 'desc')
  .paginate(15)
```

#### 5.2.3 ORM (Models)

**Requirements:**

- Each model maps to a database table
- Relationships: `hasOne`, `hasMany`, `belongsTo`, `belongsToMany`, `hasManyThrough`
- Eager loading: `User.with('posts', 'posts.comments').get()` — prevents N+1
- Lazy eager loading: `user.load('posts')`
- Soft deletes via `SoftDeletes` mixin
- Automatic timestamps: `created_at`, `updated_at`
- Mass assignment protection: `fillable` / `guarded` arrays
- Attribute casting: `casts: { is_admin: 'boolean', settings: 'json' }`
- Model events: `creating`, `created`, `updating`, `updated`, `deleting`, `deleted`
- Scopes: reusable query constraints defined on the model
- Accessors and mutators for computed/transformed attributes

**API Surface (target):**

```typescript
class User extends Model {
  table = 'users'
  fillable = ['name', 'email']
  casts = { settings: 'json' }

  posts() {
    return this.hasMany(Post)
  }
}

const users = await User.where('active', true).with('posts').get()
```

#### 5.2.4 Migrations

**Requirements:**

- Timestamped migration files: `2026_03_18_000001_create_users_table.ts`
- Schema builder for table creation and alteration
- Column types: string, integer, bigInteger, boolean, text, json, timestamp, date, enum, uuid, binary
- Index creation: primary, unique, index, composite
- Foreign keys with cascade options
- `up()` and `down()` methods for forward and rollback
- Migration state tracked in a `migrations` table
- CLI commands: `mantiq migrate`, `mantiq migrate:rollback`, `mantiq migrate:fresh`, `mantiq migrate:status`

**API Surface (target):**

```typescript
export default class CreateUsersTable extends Migration {
  async up() {
    await this.schema.create('users', (table) => {
      table.id()
      table.string('name')
      table.string('email').unique()
      table.string('password')
      table.boolean('active').default(true)
      table.json('settings').nullable()
      table.timestamps()
      table.softDeletes()
    })
  }

  async down() {
    await this.schema.drop('users')
  }
}
```

#### 5.2.5 Seeders & Factories

**Requirements:**

- Factory classes define how to generate fake model instances
- Faker integration for generating realistic test data
- Factory states for variations: `UserFactory.state('admin')`, `UserFactory.state('unverified')`
- Seeder classes that call factories or insert data directly
- CLI command: `mantiq db:seed`, `mantiq db:seed --class=UserSeeder`

---

### 5.3 @mantiq/inertia — Inertia Protocol Adapter

#### 5.3.1 Server Adapter

**Requirements:**

- Detect `X-Inertia` header on incoming requests
- Return JSON page objects: `{ component, props, url, version }`
- Handle partial reload requests via `X-Inertia-Partial-Data` and `X-Inertia-Partial-Component` headers
- On non-Inertia requests, return full HTML shell with serialized page data
- Asset versioning: compare `X-Inertia-Version` header, force full reload on mismatch
- Lazy prop evaluation — props marked as lazy only resolve when explicitly requested

#### 5.3.2 Shared Data

**Requirements:**

- `HandleInertiaRequests` middleware that merges global props into every response
- Default shared data: authenticated user, flash messages, validation errors
- Developers can add custom shared data by extending the middleware
- Flash messages bridge: `session.flash('success', 'User created')` → available as shared prop

#### 5.3.3 Response Helper

**Requirements:**

- Simple controller return: `return Inertia.render('Users/Index', { users })`
- Redirect with flash: `return Inertia.redirect('/users').with('success', 'Created')`
- Location response for external redirects
- Back helper: `return Inertia.back()`

#### 5.3.4 SSR Support

**Requirements:**

- Optional server-side rendering using Bun's native JS execution
- SSR server runs as a separate process or inline
- Render initial HTML on the server, hydrate on the client
- Configurable: enable/disable per route or globally
- Framework architecture must not block SSR even if not implemented in v1

---

### 5.4 @mantiq/vite — Vite+ Integration

#### 5.4.1 Dev Mode

**Requirements:**

- Helper function generates `<script>` tags pointing to Vite+ dev server
- Auto-detects whether the dev server is running
- HMR support through Vite+ client injection
- Configurable dev server port and host

#### 5.4.2 Production Mode

**Requirements:**

- Read Vite+ build manifest (`manifest.json`)
- Resolve entry points to hashed filenames
- Output correct `<script>` and `<link>` tags with integrity hashes
- Support multiple entry points
- CSS extraction handling

#### 5.4.3 HTML Shell

**Requirements:**

- Minimal function that renders the root HTML document
- Includes `<!DOCTYPE html>`, `<html>`, `<head>` with Vite+ asset tags, `<body>` with Inertia root `<div id="app">`
- Serializes initial page data into a `data-page` attribute
- Supports custom `<head>` content (meta tags, title, etc.)

#### 5.4.4 Configuration

**Requirements:**

- `config/vite.ts` with dev server port, build output directory, entry points
- Vite+ plugin for the frontend config that resolves aliases and configures the build

---

### 5.5 @mantiq/auth

#### 5.5.1 Session Authentication

**Requirements:**

- Login: verify credentials, regenerate session, store user identifier
- Logout: flush session, invalidate remember token
- Remember me: long-lived token stored in cookie, validated against database
- Session guard: resolves authenticated user from session on each request
- Password confirmation: re-authenticate for sensitive actions

#### 5.5.2 Token Authentication

**Requirements:**

- API token issuance: generate hashed tokens stored in database
- Token validation on each request via `Authorization: Bearer` header
- Token abilities/scopes for fine-grained permissions
- Token expiration support
- Stateless — no session required

#### 5.5.3 Middleware

**Requirements:**

- `auth` middleware: verify authentication, redirect to login or return 401
- `guest` middleware: redirect authenticated users away from login/register
- `auth:api` middleware variant for token-based routes
- `verified` middleware: ensure email is verified

#### 5.5.4 Password Hashing

**Requirements:**

- Bcrypt as default driver
- Argon2 as alternative driver
- Uses Bun's native crypto APIs
- Configurable cost factor
- Automatic rehashing when cost factor changes

#### 5.5.5 Auth Scaffolding

**Requirements:**

- Login, register, forgot password, reset password, email verification flows
- Provided as Inertia pages in the starter kits
- Backend controllers and routes included in auth package
- Developers can override any page or controller

---

### 5.6 @mantiq/cli

#### 5.6.1 Command Runner

**Requirements:**

- Entry point: `bunx mantiq <command>`
- Discovers commands from `app/Console/Commands/` and framework packages
- Parses arguments, options, and flags
- Colorized terminal output
- Interactive prompts: confirm, choice, text input, table output, progress bars
- Command scheduling (cron-like) for recurring tasks

#### 5.6.2 Code Generators

Each generator creates a file in the correct directory with proper boilerplate.

| Command                        | Output                                  |
|--------------------------------|-----------------------------------------|
| `mantiq make:controller Name`  | `app/Http/Controllers/Name.ts`          |
| `mantiq make:model Name`       | `app/Models/Name.ts`                    |
| `mantiq make:middleware Name`  | `app/Http/Middleware/Name.ts`           |
| `mantiq make:migration name`  | `database/migrations/timestamp_name.ts` |
| `mantiq make:seeder Name`     | `database/seeders/Name.ts`              |
| `mantiq make:factory Name`    | `database/factories/Name.ts`            |
| `mantiq make:request Name`    | `app/Http/Requests/Name.ts`             |
| `mantiq make:command Name`    | `app/Console/Commands/Name.ts`          |
| `mantiq make:job Name`        | `app/Jobs/Name.ts`                      |
| `mantiq make:event Name`      | `app/Events/Name.ts`                    |
| `mantiq make:listener Name`   | `app/Listeners/Name.ts`                 |
| `mantiq make:provider Name`   | `app/Providers/Name.ts`                 |
| `mantiq make:resource Name`   | Controller + Model + Migration + Factory + Seeder (all at once) |

#### 5.6.3 Dev Server Command

**Requirements:**

- `mantiq dev` starts both the Bun HTTP server and the Vite+ dev server
- Colorized, interleaved output with clear labels for which server is logging
- File watching for server restart on backend changes
- Configurable ports

#### 5.6.4 Database Commands

| Command                    | Action                                    |
|----------------------------|-------------------------------------------|
| `mantiq migrate`           | Run pending migrations                    |
| `mantiq migrate:rollback`  | Roll back last batch of migrations        |
| `mantiq migrate:fresh`     | Drop all tables and re-run all migrations |
| `mantiq migrate:status`    | Show which migrations have run            |
| `mantiq db:seed`           | Run seeders                               |
| `mantiq db:wipe`           | Drop all tables                           |

#### 5.6.5 Utility Commands

| Command                    | Action                                    |
|----------------------------|-------------------------------------------|
| `mantiq route:list`        | Display all registered routes             |
| `mantiq config:cache`      | Cache config for production               |
| `mantiq route:cache`       | Cache routes for production               |
| `mantiq cache:clear`       | Clear application cache                   |
| `mantiq key:generate`      | Generate application encryption key       |
| `mantiq serve`             | Start production server                   |

#### 5.6.6 Queue Commands

| Command                    | Action                                    |
|----------------------------|-------------------------------------------|
| `mantiq queue:work`        | Start a queue worker                      |
| `mantiq queue:listen`      | Start worker (restarts between jobs — dev)|
| `mantiq queue:restart`     | Gracefully restart all workers            |
| `mantiq queue:failed`      | List all failed jobs                      |
| `mantiq queue:retry <id>`  | Retry a failed job (or `all`)             |
| `mantiq queue:forget <id>` | Delete a failed job                       |
| `mantiq queue:flush`       | Delete all failed jobs                    |
| `mantiq queue:monitor`     | Real-time queue monitoring dashboard      |
| `mantiq queue:clear`       | Clear all jobs from a queue               |

#### 5.6.7 Realtime Commands

| Command                    | Action                                           |
|----------------------------|--------------------------------------------------|
| `mantiq realtime:start`    | Start realtime server (if separate from HTTP)    |
| `mantiq make:channel Name` | Generate a channel authorization class           |

---

### 5.7 @mantiq/validation

#### 5.7.1 Rule Engine

**Requirements:**

- Declarative validation rules: `required`, `string`, `email`, `min`, `max`, `in`, `unique`, `confirmed`, `regex`, `date`, `numeric`, `boolean`, `array`, `url`, `uuid`
- Custom rule classes
- Conditional rules: `requiredIf`, `requiredUnless`
- Nested/array validation: `'items.*.name': 'required|string'`
- Rule chaining via string (`'required|string|max:255'`) or array syntax

#### 5.7.2 Form Requests

**Requirements:**

- Dedicated request classes in `app/Http/Requests/`
- `rules()` method defines validation rules
- `authorize()` method for authorization checks
- Validated automatically before controller method executes
- On failure: redirect back with errors (web) or return 422 JSON (API)
- Error messages integrate with Inertia shared props

---

### 5.8 @mantiq/queue

The queue system is the backbone for anything that shouldn't block an HTTP request — sending emails, processing uploads, dispatching webhooks, generating reports, broadcasting events. In a real application, most work beyond reading and writing data flows through the queue.

#### 5.8.1 Job Definition

Jobs are classes in `app/Jobs/` that encapsulate a unit of work.

**Requirements:**

- Each job has a `handle()` method that contains the work logic
- Constructor accepts serializable data (the job's payload)
- Dependencies injected into `handle()` via the service container
- Jobs must be fully serializable — all constructor arguments are stored and reconstructed when the worker picks up the job
- Typed job payloads — TypeScript enforces that the data passed to a job matches what it expects

**Job Configuration (per-job):**

- `queue` — which named queue this job runs on (default: `'default'`)
- `connection` — which queue driver to use (overrides app default)
- `tries` — maximum number of attempts before marking as failed (default: 3)
- `backoff` — delay strategy between retries: fixed (`'30s'`), linear (`'30s,60s,120s'`), or exponential (`'exponential:30s'`)
- `timeout` — maximum execution time before the job is killed (default: `'60s'`)
- `retryUntil` — timestamp-based deadline: keep retrying until this time, regardless of attempt count
- `deleteWhenMissingModels` — if a related model is deleted before the job runs, silently discard the job instead of failing

**API Surface (target):**

```typescript
class ProcessPayment extends Job {
  queue = 'payments'
  tries = 5
  backoff = 'exponential:30s'
  timeout = '120s'

  constructor(private order: Order) {
    super()
  }

  async handle(stripe: StripeService) {
    await stripe.charge(this.order.total, this.order.paymentMethod)
  }

  async failed(error: Error) {
    await notify(this.order.user, 'Payment failed for order #' + this.order.id)
  }
}
```

#### 5.8.2 Dispatching

**Requirements:**

- Basic dispatch: `dispatch(new ProcessPayment(order))`
- Delayed dispatch: `dispatch(new SendReminder(user)).delay('2h')`
- Dispatch to specific queue: `dispatch(job).onQueue('emails')`
- Dispatch to specific connection: `dispatch(job).onConnection('redis')`
- Conditional dispatch: `dispatch(job).unless(order.isPaid)`
- Dispatch after response: `dispatchAfterResponse(new LogAnalytics(request))` — runs after the HTTP response is sent but in the same process (not queued)
- Bulk dispatch: `dispatch.batch([job1, job2, job3])` — enqueue multiple jobs in a single operation

#### 5.8.3 Job Chaining

Run a sequence of jobs where each job executes only if the previous one succeeded. If any job in the chain fails, the remaining jobs are cancelled.

**Requirements:**

- Chain syntax: `chain([new ProcessPayment(order), new SendReceipt(order), new UpdateInventory(order)]).dispatch()`
- `catch` callback: define what happens when a job in the chain fails
- Each job in the chain receives no implicit data from the previous job — they share data through the database or other persistent state

**API Surface (target):**

```typescript
chain([
  new ProcessPayment(order),
  new SendReceipt(order),
  new UpdateInventory(order),
])
  .catch(async (error) => {
    await notify(order.user, 'Order processing failed')
  })
  .dispatch()
```

#### 5.8.4 Job Batching

Dispatch a group of jobs and track their collective progress. Useful for processing a CSV of records, sending a batch of notifications, or running parallel imports.

**Requirements:**

- Batch syntax: `batch([...jobs]).then(callback).catch(callback).finally(callback).dispatch()`
- `then` — runs when all jobs in the batch complete successfully
- `catch` — runs when any job in the batch fails (after retries exhausted)
- `finally` — runs when the batch is fully processed (all succeeded or failed)
- Progress tracking: batch knows how many jobs are total, pending, completed, failed
- Allow adding jobs to a batch dynamically from within a running job
- Cancellation: cancel all remaining jobs in a batch
- Batch ID accessible from within any job in the batch

**API Surface (target):**

```typescript
const batch = await batch([
  new ImportUser(row1),
  new ImportUser(row2),
  new ImportUser(row3),
])
  .then(async (batch) => {
    await notify(admin, `Import complete: ${batch.totalJobs} users processed`)
  })
  .catch(async (batch, error) => {
    await notify(admin, `Import had failures: ${batch.failedJobs} failed`)
  })
  .onQueue('imports')
  .dispatch()

// Later: check progress
const status = await Queue.batch(batch.id)
// { totalJobs: 3, pendingJobs: 1, completedJobs: 1, failedJobs: 1, progress: 66 }
```

#### 5.8.5 Queue Drivers

Each driver implements the same contract. The application code (jobs, dispatch calls) doesn't know or care which driver is active.

**SQLite Driver (default):**

- Uses Bun's native `bun:sqlite` — zero config, no external services
- Jobs stored in a `queue_jobs` table with columns for queue name, payload, attempts, available_at, reserved_at, created_at
- Failed jobs stored in a `queue_failed_jobs` table
- Batch metadata stored in a `queue_batches` table
- Polling-based: worker checks for available jobs at a configurable interval
- Row-level locking via SQLite transactions to prevent duplicate processing
- Good for development, single-server deployments, and low-to-medium throughput
- Automatic table creation on first use (migration not required)

**Redis Driver:**

- Uses Redis lists and sorted sets for O(1) push/pop
- Blocking pop (`BRPOP`) for near-instant job pickup with no polling overhead
- Delayed jobs use sorted sets with score = available timestamp
- Reliable queue pattern: jobs move to a processing list on pickup, removed on completion, returned to queue on timeout
- Visibility timeout: if a worker crashes, the job becomes available again after a configurable window
- Supports multiple Redis connections for isolation
- Recommended for production and multi-server deployments

**Memory Driver (sync):**

- Executes jobs immediately in the same process, synchronously
- No persistence — jobs are lost on crash
- For testing: capture dispatched jobs without executing, assert what was dispatched
- `Queue.fake()` activates this driver and provides assertion helpers

**Database Driver (Postgres/MySQL):**

- Same design as SQLite driver but uses the application's primary database
- `FOR UPDATE SKIP LOCKED` for efficient concurrent worker access (Postgres)
- Useful when Redis isn't available but SQLite's single-writer limitation is a bottleneck

#### 5.8.6 Worker

The worker is a long-running process that pulls jobs from the queue and executes them.

**Requirements:**

- CLI: `mantiq queue:work`
- `--queue=payments,emails,default` — process specific queues in priority order
- `--connection=redis` — use a specific driver
- `--concurrency=4` — run N jobs in parallel using Bun's async capabilities (not child processes)
- `--sleep=3` — seconds to wait when no jobs available (polling interval for SQLite)
- `--tries=3` — override default retry count
- `--timeout=60` — override default job timeout in seconds
- `--memory=128` — restart the worker if memory exceeds N MB
- `--stop-when-empty` — process all available jobs then exit (useful for CI/cron)
- `--max-jobs=1000` — restart after processing N jobs (prevents memory leaks)
- `--max-time=3600` — restart after N seconds (hourly restart for stability)
- Graceful shutdown: finish the current job before exiting on SIGTERM/SIGINT
- Worker restarts: `mantiq queue:restart` signals all workers to gracefully restart after their current job completes

#### 5.8.7 Failed Job Handling

When a job exhausts all retry attempts, it is marked as failed.

**Requirements:**

- Failed jobs stored in persistent storage (failed_jobs table) with full payload, exception, failed_at timestamp, queue name, and connection
- Per-job `failed()` method: runs when the job definitively fails (all retries exhausted) — used for alerting, cleanup, compensation logic
- Global failure handler: configurable in a service provider for cross-cutting failure behavior (e.g., report all failures to an error tracking service)
- CLI: `mantiq queue:failed` — list all failed jobs
- CLI: `mantiq queue:retry <id>` — push a specific failed job back to the queue
- CLI: `mantiq queue:retry all` — retry all failed jobs
- CLI: `mantiq queue:forget <id>` — delete a specific failed job
- CLI: `mantiq queue:flush` — delete all failed jobs

#### 5.8.8 Rate Limiting

Control how frequently certain jobs can execute. Prevents API rate limit violations, database overload, or third-party service abuse.

**Requirements:**

- Per-job rate limiting: `rateLimit = { maxAttempts: 10, decayMinutes: 1 }` — max 10 executions per minute
- Named rate limiters: define rate limits in a service provider, reference by name in jobs
- When rate limited: job is released back to the queue with a delay (not failed)
- Supports Redis-backed distributed rate limiting for multi-server deployments
- Funnel limiting: only one job of a given type can run at a time (mutex/lock pattern)

**API Surface (target):**

```typescript
class CallExternalApi extends Job {
  middleware() {
    return [new RateLimit('external-api', 30, 1)] // 30 per minute
  }
}

class ProcessWebhook extends Job {
  middleware() {
    return [new Funnel('webhook:' + this.provider, 1)] // one at a time per provider
  }
}
```

#### 5.8.9 Job Middleware

Jobs can have their own middleware stack, separate from HTTP middleware. Job middleware runs before and after the job's `handle()` method.

**Requirements:**

- Per-job middleware defined via a `middleware()` method on the job class
- Built-in job middleware: `RateLimit`, `Funnel`, `WithoutOverlapping`, `ThrottleExceptions`
- `WithoutOverlapping` — uses atomic locks to prevent duplicate processing of the same job
- `ThrottleExceptions` — if a job throws N times within a window, release it with increasing delay instead of burning through retries immediately
- Custom job middleware: developer can write their own

#### 5.8.10 Unique Jobs

Prevent duplicate jobs from being enqueued.

**Requirements:**

- `unique = true` on a job class means only one instance of this job (by key) can exist in the queue at a time
- `uniqueFor = '10m'` — the uniqueness lock expires after a duration
- `uniqueId()` method: define what makes a job unique (default: class name + serialized constructor args)
- Lock released when the job completes (or the duration expires)
- Uses atomic locks (SQLite transactions or Redis `SET NX`)

#### 5.8.11 Job Events

Observable lifecycle events for monitoring and cross-cutting concerns.

**Requirements:**

- `jobProcessing` — fired before a job's `handle()` runs
- `jobProcessed` — fired after a job completes successfully
- `jobFailed` — fired when a job fails (each attempt, not just final failure)
- `jobExceptionOccurred` — fired when a job throws but will be retried
- Listeners registered globally via a service provider
- Useful for logging, metrics, alerting, and custom monitoring dashboards

#### 5.8.12 Queue Monitoring & Observability

**Requirements:**

- `mantiq queue:monitor` — real-time CLI dashboard showing queue sizes, throughput, failure rates
- Programmatic access: `Queue.size('payments')`, `Queue.failing()` for health checks
- Integration points for external monitoring (expose metrics via an endpoint or log format)

#### 5.8.13 Configuration

`config/queue.ts` defines connections, default queue, and global settings.

**Structure:**

```typescript
export default {
  default: env('QUEUE_CONNECTION', 'sqlite'),

  connections: {
    sqlite: {
      driver: 'sqlite',
      database: env('DB_DATABASE', 'database/database.sqlite'),
      table: 'queue_jobs',
      retryAfter: 90, // seconds before a reserved job is considered timed out
    },
    redis: {
      driver: 'redis',
      connection: 'default', // references config/database.ts redis config
      queue: 'default',
      retryAfter: 90,
      blockFor: 5, // BRPOP timeout in seconds
    },
    sync: {
      driver: 'memory',
    },
  },

  batching: {
    database: env('DB_DATABASE', 'database/database.sqlite'),
    table: 'queue_batches',
  },

  failed: {
    database: env('DB_DATABASE', 'database/database.sqlite'),
    table: 'queue_failed_jobs',
  },
}
```

#### 5.8.14 Testing Helpers

**Requirements:**

- `Queue.fake()` — intercepts all dispatches, stores them in memory
- `Queue.assertDispatched(ProcessPayment)` — assert a job was dispatched
- `Queue.assertDispatched(ProcessPayment, (job) => job.order.id === 1)` — assert with condition
- `Queue.assertNotDispatched(SendReceipt)` — assert a job was not dispatched
- `Queue.assertCount(3)` — assert total number of dispatched jobs
- `Queue.assertChained([ProcessPayment, SendReceipt])` — assert chain was dispatched
- `Queue.assertBatched((batch) => batch.jobs.length === 5)` — assert batch was dispatched
- `Queue.fake()` in test mode makes jobs run synchronously when explicitly triggered: `Queue.fake(); dispatch(job); Queue.processAll()`

---

### 5.9 @mantiq/cache

**Requirements:**

- Drivers: memory (default), file, Redis
- Simple API: `cache.get(key)`, `cache.put(key, value, ttl)`, `cache.forget(key)`, `cache.remember(key, ttl, callback)`, `cache.flush()`
- Tagged cache for group invalidation
- Atomic locks
- Configuration in `config/cache.ts`

---

### 5.10 @mantiq/mail

**Requirements:**

- Transport drivers: SMTP, Resend, Mailgun, SES, log (for dev)
- Message builder: `Mail.to(user).subject('Welcome').send(new WelcomeEmail(user))`
- Mailable classes with structured `build()` method
- HTML and plain text content
- Attachments
- Queued sending: `Mail.to(user).queue(new WelcomeEmail(user))`
- Configuration in `config/mail.ts`

---

### 5.11 @mantiq/events

**Requirements:**

- Event classes in `app/Events/`
- Listener classes in `app/Listeners/`
- Registration via service provider or attribute/decorator
- Synchronous dispatch by default
- Queueable listeners for async processing
- Event discovery: auto-register listeners based on naming convention
- Dispatch syntax: `emit(new UserRegistered(user))`

---

### 5.12 @mantiq/realtime

Real-time communication is a native citizen in MantiqJS, not a bolted-on afterthought. Bun provides first-class WebSocket support in `Bun.serve()`, and MantiqJS wraps it with a channel-based abstraction that makes building real-time features feel as natural as defining routes.

The developer thinks in channels and events. The transport (WebSocket or SSE) is a configuration choice, not something that changes application code.

#### 5.12.1 Channels

Channels are named conduits that clients subscribe to and the server pushes events into. Channels are defined in `routes/channels.ts` and authorization logic lives in `app/Channels/`.

**Channel Types:**

**Public channels** — any connected client can subscribe. No authorization required. Use for system-wide broadcasts, live scoreboards, public activity feeds.

```typescript
// routes/channels.ts
channel('announcements', () => true)
channel('scores.:gameId', () => true)
```

**Private channels** — requires authentication. The framework verifies the user has an active session or valid token before allowing the subscription. Use for user-specific notifications, team updates, order status.

```typescript
// routes/channels.ts
channel('private:orders.:orderId', (user, orderId) => {
  return user.orders.includes(orderId)
})
```

**Presence channels** — like private, but the server tracks which users are currently subscribed. Provides `join`, `leave`, and `here` (list of current members) events automatically. Use for "who's online" indicators, collaborative editing, typing indicators.

```typescript
// routes/channels.ts
presence('presence:project.:projectId', {
  authorize: (user, projectId) => user.projects.includes(projectId),
  userInfo: (user) => ({ id: user.id, name: user.name, avatar: user.avatar }),
})
```

#### 5.12.2 Broadcasting Events

Any event class can be marked as broadcastable. When the event is dispatched, the event system handles listeners normally, and the realtime system simultaneously pushes the event data to all clients subscribed to the specified channels.

**Requirements:**

- Event class implements a `broadcastOn()` method returning channel name(s)
- `broadcastAs()` — optional custom event name (default: class name)
- `broadcastWith()` — optional custom payload (default: all public properties)
- Broadcasting can be queued so it doesn't block the HTTP response
- Broadcast from anywhere: controllers, jobs, event listeners, commands

**API Surface (target):**

```typescript
class OrderShipped extends Event implements ShouldBroadcast {
  queue = 'broadcasts' // optional: queue the broadcast

  constructor(public order: Order) {
    super()
  }

  broadcastOn() {
    return ['private:orders.' + this.order.id]
  }

  broadcastWith() {
    return {
      orderId: this.order.id,
      status: 'shipped',
      trackingNumber: this.order.trackingNumber,
    }
  }
}

// In a controller:
emit(new OrderShipped(order)) // listeners run + broadcast to channel
```

**Direct broadcasting without events:**

```typescript
broadcast('private:orders.' + order.id, 'status-updated', {
  status: 'shipped',
})
```

#### 5.12.3 WebSocket Transport

Bun's native WebSocket support runs on the same port as HTTP — no separate server, no proxy configuration, no extra processes.

**Requirements:**

- WebSocket upgrade handled by the HTTP kernel (see 5.1.3a)
- Authentication on upgrade: session cookies or token in query string, validated before the connection is accepted
- Per-connection state: authenticated user, subscribed channels, custom metadata — stored in Bun's `ws.data`
- Client subscribes to channels by sending a `subscribe` message after connecting
- Server validates channel authorization on each subscription request
- Client can unsubscribe from channels
- Server pushes events as JSON frames: `{ event: 'OrderShipped', channel: 'private:orders.123', data: { ... } }`
- Bidirectional messaging: client can send messages to channels (for chat, collaborative features)
- Client-to-server messages routed through a handler registry (similar to routes but for WS messages)
- Heartbeat/ping-pong for connection health monitoring
- Automatic cleanup on disconnect: remove from all presence channels, fire `leave` events
- Backpressure handling via Bun's native `drain` callback
- Connection limits: configurable max connections per user and globally

**Pub/Sub via Bun:**

Bun's built-in pub/sub (`ws.subscribe(topic)`, `ws.publish(topic, data)`) maps directly to the channel concept. The framework uses this for efficient message distribution without maintaining manual subscriber lists.

#### 5.12.4 SSE Transport

Server-Sent Events provide a simpler, unidirectional alternative to WebSockets. SSE works through standard HTTP, passes through proxies and load balancers without configuration, and handles reconnection automatically.

**Requirements:**

- Dedicated SSE endpoint (e.g., `/mantiq/sse`) handled by middleware or a built-in controller
- Authentication: session cookie or Bearer token validated on the initial HTTP request
- Channel subscriptions specified via query parameters or initial POST body
- Server holds open a `ReadableStream` response with `Content-Type: text/event-stream`
- Events pushed as SSE format: `event: OrderShipped\ndata: {"orderId":123}\n\n`
- `Last-Event-ID` support: client sends the last received event ID on reconnect, server replays missed events from a short-lived buffer
- Configurable event buffer size and duration for replay
- Keep-alive comments (`:heartbeat\n\n`) to prevent proxy timeouts
- Graceful connection cleanup on client disconnect
- Multiple channel subscriptions on a single SSE connection

**When to recommend SSE vs WebSocket:**

- SSE: notifications, activity feeds, dashboards, any one-way server-to-client push. Simpler client code, works everywhere, reconnects automatically.
- WebSocket: chat, collaborative editing, gaming, any bidirectional communication. More capable but more complex.
- Framework documentation should guide developers to the right choice, but the channel/broadcasting API is identical regardless of transport.

#### 5.12.5 Client-Side Integration

**@mantiq/echo (companion client package):**

A lightweight client-side library that connects to the MantiqJS realtime server and provides a clean API for subscribing to channels and listening for events. Ships with adapters for WebSocket and SSE.

**Requirements:**

- Works with React, Vue, Svelte, and vanilla JS
- Auto-detects transport based on configuration (WebSocket default, SSE fallback)
- Automatic reconnection with exponential backoff
- Channel subscription API mirrors the server-side naming
- TypeScript types for event payloads (generated or manually typed)

**API Surface (target):**

```typescript
import { Echo } from '@mantiq/echo'

const echo = new Echo({
  transport: 'websocket', // or 'sse'
  endpoint: '/mantiq/ws', // or '/mantiq/sse'
})

// Public channel
echo.channel('announcements').listen('NewAnnouncement', (data) => {
  console.log(data.message)
})

// Private channel
echo.private('orders.' + orderId).listen('OrderShipped', (data) => {
  updateTrackingUI(data.trackingNumber)
})

// Presence channel
echo.join('project.' + projectId)
  .here((members) => updateMemberList(members))
  .joining((member) => addToMemberList(member))
  .leaving((member) => removeFromMemberList(member))
  .listen('DocumentEdited', (data) => refreshDocument(data))

// Cleanup
echo.leave('project.' + projectId)
echo.disconnect()
```

**Compatibility note:** If the protocol is compatible with Laravel Echo's format, developers could use the official Laravel Echo client library directly. This is a design goal but not a hard requirement — MantiqJS should prioritize clean protocol design over backwards compatibility with Echo.

#### 5.12.6 Scaling Real-Time

Single-server deployments work out of the box — Bun's pub/sub handles everything in-process. Multi-server deployments need a shared message bus so events broadcast on one server reach clients connected to another.

**Requirements:**

- Single server: Bun's native pub/sub, no configuration needed
- Multi-server: Redis pub/sub adapter — events published to Redis, all servers subscribe and forward to their local clients
- Driver interface: the broadcasting layer codes against a contract, so custom adapters (e.g., NATS, RabbitMQ) can be plugged in
- Horizontal scaling: each server manages its own connections, Redis handles cross-server message distribution
- Configuration in `config/realtime.ts`

#### 5.12.7 Configuration

```typescript
// config/realtime.ts
export default {
  default: env('BROADCAST_DRIVER', 'bun'),

  drivers: {
    bun: {
      // Single server — uses Bun's native pub/sub
    },
    redis: {
      connection: 'default', // references config/database.ts redis config
    },
    log: {
      // Writes broadcast events to log (for debugging)
    },
    null: {
      // Discards all broadcasts (for testing without Queue.fake)
    },
  },

  // WebSocket settings
  websocket: {
    path: '/mantiq/ws',
    maxConnectionsPerUser: 10,
    maxConnectionsGlobal: 10000,
    heartbeatInterval: 30, // seconds
  },

  // SSE settings
  sse: {
    path: '/mantiq/sse',
    replayBufferSize: 100, // events
    replayBufferDuration: 300, // seconds
    keepAliveInterval: 15, // seconds
  },

  // Presence channel settings
  presence: {
    memberTtl: 60, // seconds before a disconnected member is removed
  },
}
```

#### 5.12.8 CLI Commands

| Command                    | Action                                                     |
|----------------------------|------------------------------------------------------------|
| `mantiq realtime:start`    | Start realtime server (if running separately from HTTP)    |
| `mantiq make:channel Name` | Generate a channel authorization class                     |

#### 5.12.9 Testing Helpers

**Requirements:**

- `Broadcast.fake()` — intercept all broadcasts, store in memory
- `Broadcast.assertSent(OrderShipped)` — assert an event was broadcast
- `Broadcast.assertSent(OrderShipped, (event) => event.order.id === 1)` — assert with condition
- `Broadcast.assertSentOn('private:orders.1', OrderShipped)` — assert event on specific channel
- `Broadcast.assertNotSent(OrderShipped)` — assert an event was not broadcast
- WebSocket test client: `ws = await connectWebSocket(user)` → `ws.subscribe('channel')` → `ws.assertReceived('EventName')`

---

### 5.13 @mantiq/logging

**Requirements:**

- Channel-based: file, stdout, stderr
- Log levels: debug, info, notice, warning, error, critical, alert, emergency
- Daily log rotation for file channel
- Configurable per environment (verbose in dev, errors only in production)
- Context injection: attach request ID, user ID to all log entries
- Configuration in `config/logging.ts`
- API: `log.info('User created', { userId: user.id })`

---

### 5.14 @mantiq/helpers — Utility Library

A zero-dependency utility library that ships with every MantiqJS app. These are the small functions developers reach for constantly — the kind of thing that otherwise leads to installing lodash, a slug library, a pluralizer, and five other micro-packages. MantiqJS makes the decision: these are built in.

The helpers package is available globally (no import required in MantiqJS apps) and also usable standalone outside the framework.

#### 5.14.1 Str — String Helpers

**Requirements:**

- `Str.camel('foo_bar')` → `'fooBar'`
- `Str.snake('fooBar')` → `'foo_bar'`
- `Str.kebab('fooBar')` → `'foo-bar'`
- `Str.pascal('foo_bar')` → `'FooBar'`
- `Str.title('hello world')` → `'Hello World'`
- `Str.slug('Hello World!')` → `'hello-world'` — URL-safe slugs with Unicode support
- `Str.plural('child')` → `'children'` — English pluralization with irregular forms
- `Str.singular('children')` → `'child'`
- `Str.random(16)` → cryptographically random string
- `Str.uuid()` → UUID v4
- `Str.ulid()` → ULID (sortable unique ID)
- `Str.mask('4242424242424242', '*', 4)` → `'4242************'`
- `Str.truncate('long text...', 20)` → truncates with ellipsis, word-boundary aware
- `Str.contains('hello world', 'world')` → `true`
- `Str.startsWith()`, `Str.endsWith()`, `Str.before()`, `Str.after()`, `Str.between()`
- `Str.is('foo*', 'foobar')` → wildcard pattern matching
- `Str.orderedUuid()` → timestamp-prefixed UUID for database index performance
- `Str.password(length, options)` → generate a secure password with configurable rules
- `Str.excerpt('long text', 'keyword', { radius: 50 })` → extract text around a keyword
- `Str.headline('foo_bar-baz')` → `'Foo Bar Baz'` — human-readable headline from any casing
- Fluent API: `Str.of('hello').upper().slug().toString()` — chainable string operations

#### 5.14.2 Arr — Array Helpers

**Requirements:**

- `Arr.wrap(value)` → ensures value is an array
- `Arr.flatten(nested, depth?)` → flatten nested arrays
- `Arr.dot({ a: { b: 1 } })` → `{ 'a.b': 1 }` — dot-notation flattening
- `Arr.undot({ 'a.b': 1 })` → `{ a: { b: 1 } }` — reverse of dot
- `Arr.get(obj, 'a.b.c', default)` → deep dot-notation access with default
- `Arr.set(obj, 'a.b.c', value)` → deep dot-notation setting
- `Arr.has(obj, 'a.b.c')` → check existence at dot path
- `Arr.forget(obj, 'a.b')` → remove a key at dot path
- `Arr.pluck(array, 'name')` → extract a single property from each item
- `Arr.keyBy(array, 'id')` → index an array by a property
- `Arr.groupBy(array, 'category')` → group items by a property or callback
- `Arr.shuffle(array)` → randomize order (Fisher-Yates)
- `Arr.chunk(array, size)` → split into chunks
- `Arr.only(obj, ['key1', 'key2'])` → pick keys from an object
- `Arr.except(obj, ['key1'])` → omit keys from an object
- `Arr.sortBy(array, key | callback)` — stable sort by property or function
- `Arr.unique(array, key?)` — deduplicate, optionally by a property
- `Arr.first(array, predicate?)`, `Arr.last(array, predicate?)`
- `Arr.random(array, count?)` — pick random item(s)

#### 5.14.3 Num — Number Helpers

**Requirements:**

- `Num.format(1234567.89)` → `'1,234,567.89'` — locale-aware formatting
- `Num.currency(99.99, 'USD')` → `'$99.99'` — currency formatting
- `Num.percentage(0.156)` → `'15.6%'`
- `Num.abbreviate(1500000)` → `'1.5M'` — human-readable large numbers
- `Num.ordinal(3)` → `'3rd'`
- `Num.fileSize(1048576)` → `'1 MB'` — human-readable file sizes
- `Num.clamp(value, min, max)` → constrain to range
- `Num.between(value, min, max)` → boolean range check
- `Num.random(min, max)` → random integer in range

#### 5.14.4 Collection — Fluent Data Manipulation

A chainable wrapper around arrays that provides a rich, lazy-evaluable API for data transformation. Inspired by Laravel Collections but with TypeScript generics for full type safety.

**Requirements:**

- `collect(array)` → wraps in a Collection instance
- Chainable transformations: `map`, `filter`, `reduce`, `flatMap`, `each`, `tap`
- Aggregation: `sum(key?)`, `avg(key?)`, `min(key?)`, `max(key?)`, `count()`, `median()`, `mode()`
- Filtering: `where(key, value)`, `whereIn(key, values)`, `whereBetween(key, [min, max])`, `whereNull(key)`, `whereNotNull(key)`, `reject(predicate)`, `first(predicate?)`, `last(predicate?)`
- Sorting: `sortBy(key | callback)`, `sortByDesc(key)`, `reverse()`
- Grouping: `groupBy(key | callback)`, `keyBy(key | callback)`, `countBy(key | callback)`, `partition(predicate)`
- Transformation: `pluck(key)`, `unique(key?)`, `flatten(depth?)`, `chunk(size)`, `zip(other)`, `combine(keys, values)`, `mapToGroups(callback)`
- Set operations: `diff(other)`, `intersect(other)`, `union(other)`, `crossJoin(...others)`
- Output: `toArray()`, `toMap()`, `toJSON()`, `all()`, `values()`, `keys()`
- Pagination integration: `forPage(page, perPage)`
- Lazy collections: `collectLazy(generator)` for memory-efficient processing of large datasets — operations are deferred and evaluated one item at a time
- Macroable: developers can register custom methods on the Collection prototype via `Collection.macro('name', fn)`

**API Surface (target):**

```typescript
const topCustomers = collect(orders)
  .groupBy('customerId')
  .map((orders, customerId) => ({
    customerId,
    total: orders.sum('amount'),
    count: orders.count(),
  }))
  .sortByDesc('total')
  .take(10)
  .toArray()
```

#### 5.14.5 Additional Utilities

- **Sleep** — `await sleep('500ms')`, `await sleep('2s')` — human-readable durations
- **Retry** — `await retry(3, callback, '100ms')` — retry with attempts and delay
- **Tap** — `tap(value, callback)` — inspect and pass through
- **Pipeline** — `pipeline(value, [fn1, fn2, fn3])` — sequential transformation
- **Once** — `const fn = once(() => expensiveComputation())` — memoize single execution
- **Benchmark** — `const ms = await benchmark(() => someWork())` — time a function
- **HtmlString** — mark a string as safe HTML (for Inertia shared props that should not be escaped)

---

## 6. Addon Packages

Addon packages extend MantiqJS with domain-specific functionality. They are installed separately (`bun add @mantiq/ai`), register through service providers, and follow the same conventions as core packages. Addons are where MantiqJS goes beyond what Laravel offers.

### 6.1 @mantiq/media — Image & File Processing

A unified API for file uploads, storage, transformations, and optimization. Handles the full lifecycle from multipart upload to CDN-ready asset.

#### 6.1.1 Storage Abstraction

**Requirements:**

- Driver-based storage: local filesystem (default), S3, GCS, Cloudflare R2
- Uniform API regardless of driver: `storage.put(path, content)`, `storage.get(path)`, `storage.delete(path)`, `storage.url(path)`, `storage.exists(path)`
- Multiple disks: `storage.disk('s3').put(...)` — switch between storage backends
- Temporary URLs: `storage.temporaryUrl(path, expiration)` — signed URLs for private files
- Streaming uploads and downloads for large files
- Configuration in `config/media.ts`

#### 6.1.2 File Uploads

**Requirements:**

- Upload handling integrated with the request object: `request.file('avatar')`
- File validation: size limits, mime types, dimensions — works with the validation system
- Automatic storage: `request.file('avatar').store('avatars')` → stores and returns the path
- Multiple file uploads: `request.files('photos')` → array of uploaded files
- Chunked uploads for large files

#### 6.1.3 Image Processing

**Requirements:**

- Built on Sharp (or Bun-native alternative when available)
- Fluent transformation API
- Resize: `image.resize(300, 300)`, `image.fit('cover')`, `image.crop(x, y, w, h)`
- Format conversion: `image.toWebP()`, `image.toAvif()`, `image.toPng()`, `image.toJpeg(quality)`
- Effects: `image.blur(5)`, `image.sharpen()`, `image.grayscale()`, `image.rotate(90)`
- Watermark: `image.watermark(overlayPath, { position: 'bottom-right', opacity: 0.5 })`
- Responsive variants: `image.variants({ thumb: [150, 150], medium: [600, 400], large: [1200, 800] })` — generate multiple sizes from a single upload
- Optimization: automatic lossy/lossless compression on output
- Metadata extraction: dimensions, EXIF data, format, color profile
- Lazy processing: transformations are queued and executed on demand or via a job

**API Surface (target):**

```typescript
// In a controller
const avatar = request.file('avatar')

await avatar
  .transform((img) => img.resize(400, 400).fit('cover').toWebP(80))
  .store('avatars', { disk: 's3' })

// Generate responsive variants
await request.file('photo')
  .variants({
    thumbnail: (img) => img.resize(150, 150).fit('cover'),
    medium: (img) => img.resize(600, null).toWebP(),
    original: (img) => img.toWebP(90),
  })
  .store('photos', { disk: 's3' })
```

#### 6.1.4 Media Library (optional model integration)

**Requirements:**

- Attach media to any model: `user.addMedia(file).toCollection('avatars')`
- Collections: group related media on a model (e.g., 'avatars', 'documents')
- Conversions: define transformations at the model level, auto-generated on upload
- Retrieve media: `user.getMedia('avatars')`, `user.getFirstMediaUrl('avatars', 'thumbnail')`
- Ordering, metadata, custom properties per media item
- Cleanup: delete associated media when the model is deleted

---

### 6.2 @mantiq/ai — AI Client

A unified AI client that abstracts across providers. The developer writes their AI logic once — the provider is a configuration choice. This is to AI what the database layer is to databases: a driver-based abstraction with a clean, consistent API.

#### 6.2.1 Multi-Provider Client

**Requirements:**

- Provider drivers: OpenAI, Anthropic, Google (Gemini), Mistral, Ollama (local), and a generic OpenAI-compatible driver for self-hosted models
- Swap providers by changing config — application code doesn't change
- Configuration in `config/ai.ts` with default provider, API keys, model defaults
- Per-request provider override: `ai.using('anthropic').complete(...)`
- Automatic retry with exponential backoff on rate limits and transient errors
- Request/response logging integration with `@mantiq/logging`

#### 6.2.2 Text Completions

**Requirements:**

- Simple completion: `const response = await ai.complete('Summarize this article: ...')`
- Chat/conversation: `await ai.chat([{ role: 'user', content: '...' }, { role: 'assistant', content: '...' }])`
- System prompts: `await ai.system('You are a helpful assistant').complete(prompt)`
- Streaming: `for await (const chunk of ai.stream(prompt)) { ... }` — real-time token streaming
- Structured output: `await ai.complete(prompt).asJson<MyType>()` — parse response as typed JSON
- Temperature, max tokens, stop sequences as per-request options
- Model selection per request: `ai.model('claude-sonnet-4-20250514').complete(prompt)`

**API Surface (target):**

```typescript
// Simple
const summary = await ai.complete('Summarize: ' + article.body)

// Structured
const analysis = await ai.complete(prompt).asJson<{
  sentiment: 'positive' | 'negative' | 'neutral'
  confidence: number
  topics: string[]
}>()

// Streaming to an SSE response
const stream = ai.stream('Write a story about...')
return response.sse(stream)

// Conversation
const reply = await ai.chat([
  { role: 'system', content: 'You are a customer support agent.' },
  { role: 'user', content: userMessage },
  ...conversationHistory,
])
```

#### 6.2.3 Embeddings

**Requirements:**

- Generate embeddings: `const vector = await ai.embed('text to embed')`
- Batch embeddings: `const vectors = await ai.embedMany(['text1', 'text2', ...])`
- Provider support: OpenAI embeddings, Anthropic (via Voyage), Google, Ollama
- Configurable model and dimensions per request
- Integration with `@mantiq/search` for AI-powered search

#### 6.2.4 Image Generation

**Requirements:**

- Generate images: `const image = await ai.image('A sunset over mountains')`
- Provider support: OpenAI (DALL-E), Stability AI, Replicate
- Options: size, quality, style, number of images
- Returns image URLs or binary data
- Automatic storage to configured disk via `@mantiq/media` integration

#### 6.2.5 Moderation & Classification

**Requirements:**

- Content moderation: `const result = await ai.moderate(text)` — returns flagged categories and scores
- Text classification: `await ai.classify(text, ['spam', 'ham', 'urgent'])` — zero-shot classification
- Useful for content moderation pipelines, support ticket routing, etc.

#### 6.2.6 Configuration

```typescript
// config/ai.ts
export default {
  default: env('AI_PROVIDER', 'openai'),

  providers: {
    openai: {
      driver: 'openai',
      key: env('OPENAI_API_KEY'),
      model: 'gpt-4o',
      organization: env('OPENAI_ORG', null),
    },
    anthropic: {
      driver: 'anthropic',
      key: env('ANTHROPIC_API_KEY'),
      model: 'claude-sonnet-4-20250514',
    },
    google: {
      driver: 'google',
      key: env('GOOGLE_AI_KEY'),
      model: 'gemini-pro',
    },
    ollama: {
      driver: 'ollama',
      host: env('OLLAMA_HOST', 'http://localhost:11434'),
      model: 'llama3',
    },
  },

  embeddings: {
    default: env('AI_EMBEDDING_PROVIDER', 'openai'),
    model: 'text-embedding-3-small',
    dimensions: 1536,
  },
}
```

---

### 6.3 @mantiq/agents — AI Agent Framework

A framework for building autonomous AI agents that can use tools, maintain memory, and execute multi-step workflows. This is where MantiqJS goes beyond simple AI wrappers and into agentic application development.

#### 6.3.1 Agent Definition

Agents are classes that combine an AI model with tools, instructions, and memory to accomplish complex tasks autonomously.

**Requirements:**

- Agent class with `instructions` (system prompt), `tools` (available actions), `model` (AI provider/model)
- Agents can be invoked from controllers, jobs, commands, or other agents
- Conversation loop: the agent reasons, selects a tool, executes it, observes the result, and continues until the task is complete or a limit is reached
- Configurable max iterations to prevent runaway loops
- Configurable max token budget per agent invocation
- Structured output: agent can be asked to return a typed result

**API Surface (target):**

```typescript
class ResearchAgent extends Agent {
  instructions = 'You are a research assistant. Use the provided tools to find and synthesize information.'
  model = 'anthropic:claude-sonnet-4-20250514'
  maxIterations = 10

  tools = [
    new WebSearchTool(),
    new DatabaseQueryTool(),
    new SummarizeTool(),
  ]
}

// In a controller
const agent = new ResearchAgent()
const result = await agent.run('Find the top 5 competitors for Acme Corp and summarize their recent funding rounds.')
```

#### 6.3.2 Tools

Tools are typed functions that agents can call. They define a name, description, input schema, and execution logic.

**Requirements:**

- Tool class with `name`, `description`, `parameters` (JSON schema or Zod schema), and `execute(input)` method
- Built-in tools: `WebSearch`, `HttpRequest`, `DatabaseQuery`, `FileRead`, `FileWrite`, `CodeExecute`, `ImageGenerate`
- Custom tools: developers define their own by extending the base Tool class
- Tool parameter validation before execution
- Tool result formatting for the AI model's consumption
- Tools have access to the service container for dependency injection

**API Surface (target):**

```typescript
class CreateTicketTool extends Tool {
  name = 'create_ticket'
  description = 'Create a support ticket in the system'
  parameters = z.object({
    title: z.string().describe('The ticket title'),
    priority: z.enum(['low', 'medium', 'high']),
    description: z.string(),
    assignTo: z.string().optional(),
  })

  async execute(input: z.infer<typeof this.parameters>) {
    return await Ticket.create(input)
  }
}
```

#### 6.3.3 Agent Memory

Agents need context across invocations — remembering past interactions, user preferences, or accumulated knowledge.

**Requirements:**

- **Conversation memory:** stores the full message history for multi-turn agent interactions
- **Summary memory:** periodically compresses long conversation histories into summaries to stay within token limits
- **Vector memory:** stores and retrieves relevant context via embeddings (integrates with `@mantiq/ai` embeddings and `@mantiq/search`)
- **Persistent memory:** key-value store for facts the agent should remember across sessions (stored in database)
- Memory is per-agent and per-user (or per-session) — agents don't share memory unless explicitly configured to
- Configurable memory strategy per agent: none, conversation, summary, vector, or a combination

#### 6.3.4 Agent Chains & Workflows

Compose multiple agents into workflows where the output of one agent feeds into the next.

**Requirements:**

- Sequential chains: `chain([ResearchAgent, AnalysisAgent, ReportAgent]).run(input)`
- Router chains: an orchestrator agent decides which specialized agent to delegate to
- Parallel execution: run multiple agents concurrently and merge their results
- Human-in-the-loop: pause the chain and wait for user input before continuing
- Workflow state: passed between agents in the chain, accumulated and transformed at each step

**API Surface (target):**

```typescript
const workflow = workflow('customer-onboarding')
  .step(new ValidateCompanyAgent())
  .step(new EnrichDataAgent())
  .step(new AssignAccountManagerAgent())
  .onFailure(async (step, error) => {
    await notify(admin, `Onboarding failed at step: ${step.name}`)
  })

const result = await workflow.run({ companyName: 'Acme Corp', email: 'hello@acme.com' })
```

#### 6.3.5 Agent Observability

Building with agents requires visibility into what they're doing — which tools they call, what reasoning they produce, how much they cost.

**Requirements:**

- Execution trace: full log of each iteration (reasoning, tool calls, tool results, tokens used)
- Cost tracking: token usage per invocation, mapped to estimated dollar cost per provider
- Trace storage: save traces to database for debugging and auditing
- Trace viewer: a dev-mode UI or CLI command to inspect agent execution traces
- Integration with `@mantiq/logging` for production monitoring
- Events: `agentStarted`, `agentToolCalled`, `agentCompleted`, `agentFailed` — hookable via `@mantiq/events`

#### 6.3.6 MCP (Model Context Protocol) Support

MantiqJS agents can act as MCP clients and the framework can expose MCP servers, enabling interop with the growing MCP ecosystem.

**Requirements:**

- **MCP Client:** agents can connect to external MCP servers to use their tools — e.g., connect to a database MCP server, a Slack MCP server, or any third-party MCP tool provider
- **MCP Server:** expose your application's tools (database models, business logic, custom actions) as an MCP server that external AI applications can connect to
- MCP server registration via a service provider
- CLI: `mantiq make:mcp-tool Name` — generate an MCP-compatible tool class
- CLI: `mantiq mcp:serve` — start the MCP server
- Configuration in `config/mcp.ts`

---

### 6.4 @mantiq/search — Full-Text Search

Search abstraction that works with multiple backends. Keeps models searchable without coupling to a specific search engine.

**Requirements:**

- Driver-based: SQLite FTS5 (default, zero config), Meilisearch, Typesense, Algolia, Elasticsearch
- Model trait: `Searchable` mixin on any model to make it indexable
- `searchable()` method on the model defines which fields are indexed
- Auto-sync: model changes automatically update the search index (via model events or queued jobs)
- Search API: `User.search('john').where('active', true).paginate(15)`
- Bulk import: `mantiq scout:import User` — index all existing records
- Flush: `mantiq scout:flush User` — clear the index
- AI-powered semantic search: when `@mantiq/ai` is installed, support vector similarity search alongside keyword search
- Hybrid search: combine keyword relevance with vector similarity for best results

---

### 6.5 @mantiq/socialise — OAuth Authentication

Social login made trivial. One interface for all OAuth providers.

**Requirements:**

- Provider drivers: Google, GitHub, GitLab, Facebook, Twitter/X, Apple, LinkedIn, Microsoft, Discord, Slack
- Community driver interface for adding custom providers
- Redirect: `return socialite.driver('github').redirect()` — sends user to provider
- Callback: `const user = await socialite.driver('github').user()` — returns user info
- User object: `id`, `name`, `email`, `avatar`, `token`, `refreshToken`, `expiresIn`
- Stateless mode for API/SPA flows (no session required)
- Scopes: `socialite.driver('github').scopes(['repo', 'user:email']).redirect()`
- Optional auto-registration: create or link a local user account on first social login
- Configuration in `config/socialite.ts`

---

### 6.6 @mantiq/cashier — Subscription Billing

Manage subscriptions, one-time charges, invoices, and customer portals.

**Requirements:**

- Provider drivers: Stripe (primary), LemonSqueezy
- Customer management: link a user model to a billing provider customer
- Subscriptions: create, swap, cancel, resume, check status
- Trial periods: `user.onTrial()`, `user.trialEndsAt()`
- Plan checking: `user.subscribedTo('pro')`, `user.onPlan('annual')`
- One-time charges: `user.charge(amount, paymentMethod)`
- Invoices: `user.invoices()`, `user.downloadInvoice(invoiceId)`
- Webhook handling: built-in controller for provider webhooks with event dispatching
- Customer portal redirect: `user.billingPortalUrl()`
- Metered billing: report usage, provider calculates charges
- Tax handling: integration with provider's tax calculation
- Configuration in `config/cashier.ts`

---

### 6.7 @mantiq/notify — Multi-Channel Notifications

Send notifications to users through multiple channels from a single notification class.

**Requirements:**

- Notification class defines content for each channel: `toMail()`, `toSms()`, `toPush()`, `toSlack()`, `toDatabase()`, `toBroadcast()`
- Channel drivers: email (via `@mantiq/mail`), SMS (Twilio, Vonage), push (Firebase, APNs), Slack, database, broadcast (via `@mantiq/realtime`)
- Send: `user.notify(new OrderShipped(order))` or `notify(user).send(new OrderShipped(order))`
- On-demand notifications: notify an email/phone without a user model
- Queued delivery: notifications are queued by default for non-blocking sends
- Notification preferences: per-user channel preferences (opt-in/opt-out per notification type)
- Rate limiting: prevent notification spam
- Database channel: store notifications in a table, query with `user.notifications()`, mark as read
- Broadcast channel: push notification to Inertia frontend via `@mantiq/realtime` for in-app notification UI

**API Surface (target):**

```typescript
class OrderShipped extends Notification {
  constructor(private order: Order) {
    super()
  }

  via(user: User) {
    return ['mail', 'database', 'broadcast']
  }

  toMail(user: User) {
    return new MailMessage()
      .subject('Your order has shipped!')
      .greeting(`Hi ${user.name}`)
      .line(`Order #${this.order.id} is on its way.`)
      .action('Track Order', `/orders/${this.order.id}`)
  }

  toDatabase(user: User) {
    return {
      type: 'order_shipped',
      orderId: this.order.id,
      message: `Order #${this.order.id} has shipped.`,
    }
  }

  toBroadcast(user: User) {
    return {
      orderId: this.order.id,
      status: 'shipped',
    }
  }
}

// Send it
await user.notify(new OrderShipped(order))
```

---

## 7. Starter Kits

### 7.1 Scaffolding Command

```bash
bunx create-mantiq my-app --ui=react
bunx create-mantiq my-app --ui=vue
bunx create-mantiq my-app --ui=svelte
bunx create-mantiq my-app --ui=vanilla
```

### 7.2 What Each Starter Kit Includes

**Backend (identical across all kits):**

- Full MantiqJS application structure
- Auth controllers and routes (login, register, forgot/reset password, email verification)
- User model and migration
- Default middleware stack configured
- `.env` with sensible defaults
- SQLite database ready to go

**Frontend (varies by kit):**

- Vite+ configuration with the appropriate framework plugin
- Inertia client adapter installed and configured
- Tailwind CSS pre-configured
- TypeScript configured on the frontend
- Example pages: Welcome, Dashboard, Login, Register, Forgot Password, Profile
- Shared layout component with navigation
- Form helper components for Inertia forms

### 7.3 Post-Scaffold Experience

```bash
bunx create-mantiq my-app --ui=react
cd my-app
bun install
mantiq migrate
mantiq dev
# → App running at http://localhost:3000 with working auth
```

Time from zero to working app with authentication: under two minutes.

---

## 8. Configuration Defaults

### 8.1 Zero-Config Development

Out of the box, with no `.env` changes, a new MantiqJS app should work with:

| Concern     | Default                                    |
|-------------|--------------------------------------------|
| Database    | SQLite at `database/database.sqlite`       |
| Cache       | Memory driver                              |
| Session     | File driver in `storage/framework/sessions`|
| Queue       | SQLite driver (sync in dev)                |
| Mail        | Log driver (writes to `storage/logs`)      |
| Logging     | Stdout + file in `storage/logs`            |
| Broadcast   | Bun native pub/sub (single server)         |
| Server port | 3000                                       |
| Vite+ port  | 5173                                       |

### 8.2 Production Recommendations

| Concern     | Recommended                                |
|-------------|--------------------------------------------|
| Database    | PostgreSQL or MySQL                        |
| Cache       | Redis                                      |
| Session     | Redis or database                          |
| Queue       | Redis                                      |
| Mail        | SMTP, Resend, or SES                       |
| Logging     | File with rotation + external service      |
| Broadcast   | Redis pub/sub (multi-server)               |

---

## 9. Testing Strategy

### 9.1 Framework Tests

- Bun's native test runner (`bun test`)
- Unit tests for each package in isolation
- Integration tests for cross-package interactions
- HTTP tests for the full request lifecycle

### 9.2 Application Testing Helpers

The framework provides test utilities that developers use in their own apps:

- **HTTP testing:** `get('/users').assertStatus(200).assertInertia('Users/Index')`
- **Database transactions:** each test runs in a transaction that rolls back automatically
- **Authentication helpers:** `actingAs(user).get('/dashboard')`
- **Factory integration:** `const user = await UserFactory.create()`
- **Inertia assertions:** assert component name, props, shared data
- **Fake drivers:** `Queue.fake()`, `Mail.fake()`, `Event.fake()`, `Broadcast.fake()` — capture dispatched items without executing them, then assert

---

## 10. Development Phases & Milestones

### Phase 0 — Setup

- [ ] Register npm scope `@mantiq`
- [ ] Create GitHub org `mantiqjs`
- [ ] Secure domain `mantiqjs.com`
- [ ] Initialize monorepo with workspace configuration
- [ ] Set up CI/CD pipeline
- [ ] Configure Bun workspace linking between packages

### Phase 1 — Core Framework (Milestone: "Hello World")

- [ ] Service container with typed DI
- [ ] Configuration loader with env integration
- [ ] HTTP kernel wrapping `Bun.serve()`
- [ ] WebSocket kernel hooks (upgrade detection, delegation interface) — architecture only, no realtime logic
- [ ] Request and response objects with helper methods
- [ ] Router with method support, groups, named routes
- [ ] Middleware pipeline with before/after execution
- [ ] Exception handler with dev error page
- [ ] Service provider lifecycle

**Gate:** A request hits a route, passes through middleware, reaches a controller, and returns a response. WebSocket upgrade requests are detected and either delegated or rejected.

### Phase 2 — Data Layer (Milestone: "Real Work")

- [ ] Connection manager with SQLite default
- [ ] Query builder with fluent API
- [ ] Migration system with schema builder
- [ ] ORM with model definitions and relationships
- [ ] Eager loading
- [ ] Seeders and factories
- [ ] Pagination

**Gate:** Define a model, run a migration, query data, return it from a controller.

### Phase 3 — Frontend Bridge (Milestone: "Full Stack")

- [ ] Inertia server adapter with protocol compliance
- [ ] Shared data middleware
- [ ] Inertia response helper
- [ ] Vite+ dev mode integration
- [ ] Vite+ production manifest reading
- [ ] HTML shell renderer

**Gate:** Controller returns `Inertia.render()`, a React/Vue/Svelte page renders in the browser with live database data.

### Phase 4 — Auth & Validation (Milestone: "Production Ready")

- [ ] Session authentication (login, logout, remember me)
- [ ] Token authentication for APIs
- [ ] Auth middleware
- [ ] Password hashing
- [ ] Validation rule engine
- [ ] Form request classes
- [ ] CSRF protection

**Gate:** A new user can register, log in, and access protected routes.

### Phase 5 — CLI & Generators (Milestone: "Productive")

- [ ] Command runner with argument parsing
- [ ] All `make:*` generators
- [ ] Database commands (migrate, seed, rollback, status)
- [ ] `mantiq dev` dual server command
- [ ] Route listing
- [ ] Cache/config commands

**Gate:** Developer can scaffold any file type with one command and manage the full development workflow from the terminal.

### Phase 6 — Starter Kits (Milestone: "Launch Ready")

- [ ] React starter kit with auth pages
- [ ] Vue starter kit with auth pages
- [ ] Svelte starter kit with auth pages
- [ ] Vanilla starter kit
- [ ] `create-mantiq` scaffolding CLI
- [ ] Documentation site at mantiqjs.com

**Gate:** `bunx create-mantiq my-app --ui=react` → working app with auth in under two minutes.

### Phase 7 — Ecosystem (Post-Launch)

- [ ] Queue system: job dispatching, SQLite driver, worker CLI
- [ ] Queue system: Redis driver, chaining, batching
- [ ] Queue system: rate limiting, unique jobs, job middleware, monitoring
- [ ] Queue system: failed job handling, retry CLI
- [ ] Cache system with memory, file, and Redis drivers
- [ ] Mail system with transport drivers
- [ ] Event system with sync and async listeners
- [ ] Realtime: WebSocket transport with channel abstraction
- [ ] Realtime: SSE transport
- [ ] Realtime: presence channels
- [ ] Realtime: @mantiq/echo client package
- [ ] Realtime: Redis pub/sub adapter for multi-server scaling
- [ ] Logging with channels and rotation
- [ ] SSR support for Inertia
- [ ] Deployment guides (Docker, Fly.io, Railway, VPS)
- [ ] Package auto-discovery: scan `@mantiq/*` packages for a `"mantiq"` key in `package.json` declaring providers, commands, and config — auto-register them at boot without manual imports (Laravel-style `extra.laravel.providers`). Eliminates boilerplate in `index.ts` and `mantiq.ts`; packages become fully plug-and-play on install.

---

## 11. Technical Constraints & Decisions

### 11.1 Runtime

- **Bun only.** No Node.js compatibility mode. If it doesn't work on Bun, it doesn't ship.
- **Minimum Bun version:** Track the latest stable. Update minimum version quarterly.

### 11.2 Language

- **TypeScript only.** No JavaScript source files in the framework or generated application code.
- **Strict mode enabled.** `strict: true` in all tsconfig files.
- **No `any` in public APIs.** Internal use of `any` must be justified and minimized.

### 10.3 Dependencies

- **Minimize external dependencies.** Prefer Bun native APIs over npm packages.
- **No Node.js-specific packages.** No packages that depend on Node built-ins unless Bun provides full compatibility.
- **Allowed exceptions:** database drivers (pg, mysql2), established utility libraries if they significantly reduce implementation effort without adding risk.

### 10.4 Performance Targets

- **Cold start:** Under 100ms for the framework to boot and serve a request.
- **Request throughput:** Framework overhead should add less than 1ms per request to Bun's raw HTTP performance.
- **Memory:** Base framework memory footprint under 50MB.

### 10.5 Compatibility

- **Inertia protocol:** Full compliance with the Inertia.js protocol specification. Must work with official Inertia client adapters for React, Vue, and Svelte.
- **Vite+ manifest:** Compatible with Vite's manifest format. Adapt if Vite+ changes the format.

---

## 11. Documentation Plan

### 11.1 Structure (mantiqjs.com/docs)

- **Getting Started** — installation, first project, directory structure, core concepts
- **The Basics** — routing, controllers, middleware, requests, responses, views (Inertia)
- **Database** — configuration, query builder, migrations, ORM, relationships, seeding
- **Security** — authentication, authorization, CSRF, encryption, hashing
- **Frontend** — Inertia integration, Vite+ setup, asset handling, SSR
- **Advanced** — service container, service providers, events, queues, cache, mail, real-time (WebSocket & SSE)
- **Testing** — HTTP tests, database tests, mocking, factories
- **CLI** — commands reference, custom commands, scheduling
- **Deployment** — production config, optimization, Docker, cloud platforms
- **API Reference** — auto-generated from TypeScript types

### 11.2 Principles

- Every feature gets a dedicated page with a complete example
- Copy-paste friendly — code samples should work as-is
- Assumes familiarity with TypeScript but not with Laravel
- Migration guide section for developers coming from Laravel
- Migration guide section for developers coming from Express/Hono/Elysia

---

## 12. Success Criteria

### 12.1 Developer Experience

- New project to working app with auth: under 2 minutes
- Learning curve for a TypeScript developer: productive within a day
- Learning curve for a Laravel developer: productive within an hour
- Zero configuration required for local development
- Every common task has one obvious way to do it

### 12.2 Technical

- Full Inertia protocol compliance
- All official Inertia client adapters (React, Vue, Svelte) work without modification
- 100% TypeScript with no runtime type errors in generated code
- Test coverage above 90% for core and database packages
- CI passes on every commit to main

### 12.3 Community

- Comprehensive documentation before public launch
- GitHub Discussions for community support
- Clear contribution guidelines
- Semantic versioning from v1.0.0

---

## Appendix A: Naming Conventions

| Item              | Convention                          | Example                              |
|-------------------|-------------------------------------|--------------------------------------|
| Controllers       | PascalCase + `Controller` suffix    | `UserController.ts`                  |
| Models            | PascalCase, singular                | `User.ts`                            |
| Migrations        | snake_case with timestamp prefix    | `2026_03_18_000001_create_users.ts`  |
| Middleware         | PascalCase                          | `Authenticate.ts`                    |
| Seeders           | PascalCase + `Seeder` suffix        | `UserSeeder.ts`                      |
| Factories         | PascalCase + `Factory` suffix       | `UserFactory.ts`                     |
| Jobs              | PascalCase                          | `ProcessPayment.ts`                  |
| Events            | PascalCase, past tense              | `UserRegistered.ts`                  |
| Listeners         | PascalCase, action-based            | `SendWelcomeEmail.ts`                |
| Form Requests     | PascalCase + `Request` suffix       | `StoreUserRequest.ts`               |
| Channels          | PascalCase + `Channel` suffix       | `OrderChannel.ts`                    |
| Config files      | camelCase                           | `database.ts`                        |
| Route files       | camelCase                           | `web.ts`, `api.ts`, `channels.ts`    |
| Database tables   | snake_case, plural                  | `users`, `blog_posts`                |
| Database columns  | snake_case                          | `created_at`, `is_active`            |

## Appendix B: Environment Variables

```env
# Application
APP_NAME=MantiqJS
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:3000
APP_PORT=3000

# Database
DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite
# DB_HOST=127.0.0.1
# DB_PORT=5432
# DB_USERNAME=root
# DB_PASSWORD=

# Session
SESSION_DRIVER=file
SESSION_LIFETIME=120

# Cache
CACHE_DRIVER=memory

# Queue
QUEUE_CONNECTION=sqlite

# Broadcast / Realtime
BROADCAST_DRIVER=bun
# BROADCAST_DRIVER=redis

# Mail
MAIL_DRIVER=log
# MAIL_HOST=smtp.mailgun.org
# MAIL_PORT=587
# MAIL_USERNAME=
# MAIL_PASSWORD=
# MAIL_FROM_ADDRESS=hello@example.com
# MAIL_FROM_NAME="${APP_NAME}"

# Redis (when needed)
# REDIS_HOST=127.0.0.1
# REDIS_PORT=6379

# Vite+
VITE_PORT=5173
```

## Appendix C: Comparison with Laravel

| Laravel Concept        | MantiqJS Equivalent                         |
|------------------------|---------------------------------------------|
| Illuminate             | @mantiq/*                                   |
| Artisan                | `mantiq` CLI                                |
| Blade                  | Inertia (React/Vue/Svelte)                  |
| Eloquent               | @mantiq/database ORM                        |
| Vite plugin            | @mantiq/vite                                |
| Breeze / Jetstream     | Starter kits (react/vue/svelte/vanilla)     |
| Composer               | Bun package manager                         |
| PHPUnit                | Bun test runner                             |
| Laravel Forge          | — (not in scope)                            |
| Laravel Vapor          | — (not in scope)                            |
| PHP                    | TypeScript on Bun                           |

---

*This document is the living specification for MantiqJS. It should be updated as architectural decisions are made and implementation reveals new requirements.*
