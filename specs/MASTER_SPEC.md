# MantiqJS — Master Specification

> **"The logical framework for Bun"**
>
> A Laravel-inspired, batteries-included web framework built natively for the Bun runtime.

---

## 1. Vision & Philosophy

### 1.1 Core Thesis

MantiqJS brings convention-over-configuration, elegant APIs, and zero decision fatigue to the Bun/TypeScript ecosystem. It captures Laravel's philosophy — not as a port, but as an idiomatic TypeScript framework that makes every architectural decision for the developer.

### 1.2 Guiding Principles

- **Zero decision fatigue.** One clear, documented answer for every architectural question.
- **Convention over configuration.** Sensible defaults that work out of the box.
- **Backend-focused.** Frontend is the developer's choice, connected through the Inertia protocol.
- **Bun-native.** Built on Bun's native APIs. No Node.js compatibility layers.
- **Type-safe by default.** TypeScript is not optional. The type system provides better DX than string-based PHP conventions.
- **Progressively complex.** Productive in five minutes. Extensible without limits.
- **AI-built, human-architected.** This framework is constructed by AI from precise specifications. The spec is the source of truth.

### 1.3 Target Audience

- Laravel developers moving to TypeScript/Bun
- Node.js/Bun developers tired of stitching together packages
- Full-stack developers who want Rails/Laravel productivity in JS
- Teams who value convention and consistency

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
│ helpers  │          │          │ realtime · events    │
├──────────┴──────────┴──────────┴─────────────────────┤
│                  Bun Runtime APIs                      │
│  Bun.serve · WebSocket · bun:sqlite · Bun.file        │
└──────────────────────────────────────────────────────┘
```

### 3.2 Package Ecosystem

#### Core Packages (ship with framework)

| Package             | Purpose                                      | Spec File |
|---------------------|----------------------------------------------|-----------|
| `@mantiq/core`      | Service container, router, middleware, HTTP kernel, config, exception handler | [packages/core.md](packages/core.md) |
| `@mantiq/database`  | Query builder, ORM, migrations, seeders      | [packages/database.md](packages/database.md) |
| `@mantiq/inertia`   | Inertia protocol server adapter              | [packages/inertia.md](packages/inertia.md) |
| `@mantiq/vite`      | Vite+ dev server & manifest integration      | [packages/vite.md](packages/vite.md) |
| `@mantiq/auth`      | Session & token auth, guards, providers      | [packages/auth.md](packages/auth.md) |
| `@mantiq/cli`       | Command runner, code generators, dev server   | [packages/cli.md](packages/cli.md) |
| `@mantiq/validation`| Rule engine, form requests                   | [packages/validation.md](packages/validation.md) |
| `@mantiq/helpers`   | Str, Arr, Num, Collection utilities          | [packages/helpers.md](packages/helpers.md) |

#### Secondary Packages (install separately, officially maintained)

| Package             | Purpose                                      | Spec File |
|---------------------|----------------------------------------------|-----------|
| `@mantiq/queue`     | Job dispatching, workers, retry logic        | [packages/queue.md](packages/queue.md) |
| `@mantiq/cache`     | Cache drivers (memory, file, Redis)          | [packages/cache.md](packages/cache.md) |
| `@mantiq/mail`      | Mail transports, message builder             | [packages/mail.md](packages/mail.md) |
| `@mantiq/events`    | Event dispatcher, listeners                  | [packages/events.md](packages/events.md) |
| `@mantiq/realtime`  | WebSocket, SSE, channels, broadcasting       | [packages/realtime.md](packages/realtime.md) |
| `@mantiq/logging`   | Channel-based logging                        | [packages/logging.md](packages/logging.md) |

#### Addon Packages (install separately, extended ecosystem)

| Package             | Purpose                                      | Spec File |
|---------------------|----------------------------------------------|-----------|
| `@mantiq/media`     | Image/file processing, transformations, storage | [addons/media.md](addons/media.md) |
| `@mantiq/ai`        | Multi-provider AI client, embeddings, completions | [addons/ai.md](addons/ai.md) |
| `@mantiq/agents`    | AI agent framework, tools, chains, memory    | [addons/agents.md](addons/agents.md) |
| `@mantiq/search`     | Full-text search driver abstraction          | [addons/search.md](addons/search.md) |
| `@mantiq/socialise` | OAuth social authentication                  | [addons/socialise.md](addons/socialise.md) |
| `@mantiq/cashier`   | Subscription billing                         | [addons/cashier.md](addons/cashier.md) |
| `@mantiq/notify`    | Multi-channel notifications                  | [addons/notify.md](addons/notify.md) |

### 3.3 Repository Structure

```
mantiqjs/
├── specs/                  ← You are here
│   ├── MASTER_SPEC.md      ← This file
│   ├── packages/           ← Core & secondary package specs
│   └── addons/             ← Addon package specs
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
│   ├── search/
│   ├── socialise/
│   ├── cashier/
│   └── notify/
├── starters/
│   ├── react/
│   ├── vue/
│   ├── svelte/
│   └── vanilla/
├── docs/
├── package.json
├── bunfig.toml
└── README.md
```

---

## 4. Dependency Graph

This defines which packages depend on which. This is critical for build order, initialization sequence, and understanding the coupling between components.

### 4.1 Dependency Map

```
@mantiq/core          → (none — depends only on Bun APIs)
@mantiq/helpers        → (none — standalone, zero dependencies)
@mantiq/database       → @mantiq/core (container, config, events)
@mantiq/validation     → @mantiq/core (container, config)
@mantiq/auth           → @mantiq/core, @mantiq/database, @mantiq/validation
@mantiq/inertia        → @mantiq/core (middleware, response)
@mantiq/vite           → @mantiq/core (config)
@mantiq/cli            → @mantiq/core (container, config, providers)
@mantiq/queue          → @mantiq/core (container, config, events)
@mantiq/cache          → @mantiq/core (container, config)
@mantiq/mail           → @mantiq/core (container, config), @mantiq/queue (optional)
@mantiq/events         → @mantiq/core (container, config)
@mantiq/realtime       → @mantiq/core (container, config, middleware), @mantiq/events
@mantiq/logging        → @mantiq/core (container, config)

@mantiq/media          → @mantiq/core, @mantiq/database (optional)
@mantiq/ai             → @mantiq/core (container, config)
@mantiq/agents         → @mantiq/core, @mantiq/ai, @mantiq/events
@mantiq/search          → @mantiq/core, @mantiq/database
@mantiq/socialise      → @mantiq/core, @mantiq/auth
@mantiq/cashier        → @mantiq/core, @mantiq/database, @mantiq/auth
@mantiq/notify         → @mantiq/core, @mantiq/mail (optional), @mantiq/realtime (optional), @mantiq/queue (optional)
```

### 4.2 Initialization Order

When the application boots (`bootstrap/app.ts`), providers are loaded in this order:

1. **Core providers** — Container, Config, Environment
2. **Logging provider** — Available immediately for all subsequent providers
3. **Database provider** — Connections established
4. **Cache provider** — Cache connections established
5. **Session provider** — Depends on cache/database
6. **Auth provider** — Depends on session, database
7. **Validation provider** — Registers rules
8. **Routing provider** — Loads route files, registers middleware
9. **Inertia provider** — Registers Inertia middleware and response macro
10. **Vite provider** — Registers asset helpers
11. **Event provider** — Discovers and registers listeners
12. **Queue provider** — Registers queue connections and worker
13. **Mail provider** — Registers mail transports
14. **Realtime provider** — Registers WebSocket/SSE handlers
15. **Application providers** — Developer's custom providers (`app/Providers/`)

Deferred providers (lazy-loaded) are registered but not booted until their bindings are first resolved.

### 4.3 Optional Dependencies

Packages declare optional dependencies via peer dependencies. When an optional dependency is missing, the feature gracefully degrades:

- `@mantiq/mail` without `@mantiq/queue` → mail sends synchronously
- `@mantiq/notify` without `@mantiq/mail` → mail channel unavailable, others work
- `@mantiq/notify` without `@mantiq/realtime` → broadcast channel unavailable
- `@mantiq/media` without `@mantiq/database` → storage works, media library (model attachment) unavailable
- `@mantiq/agents` without `@mantiq/search` → vector memory unavailable, other memory types work

---

## 5. Cross-Cutting Contracts

These are the shared interfaces that multiple packages implement or depend on. They are defined in `@mantiq/core` and represent the "language" packages use to communicate.

### 5.1 Service Container Contract

```typescript
interface Container {
  bind<T>(abstract: Constructor<T> | symbol, concrete: Constructor<T> | Factory<T>): void
  singleton<T>(abstract: Constructor<T> | symbol, concrete: Constructor<T> | Factory<T>): void
  make<T>(abstract: Constructor<T> | symbol): T
  has(abstract: Constructor<any> | symbol): boolean
  alias(abstract: Constructor<any> | symbol, alias: string): void
  flush(): void
}

type Factory<T> = (container: Container) => T
type Constructor<T> = new (...args: any[]) => T
```

Every package receives the container through its service provider. Packages NEVER import other packages directly — they resolve dependencies through the container using contracts (interfaces).

### 5.2 Service Provider Contract

```typescript
abstract class ServiceProvider {
  constructor(protected app: Container) {}

  // Called during registration phase.
  // Bind interfaces to implementations.
  // Do NOT resolve dependencies here — other providers may not be registered yet.
  register(): void | Promise<void> {}

  // Called after ALL providers are registered.
  // Safe to resolve dependencies. Run setup logic.
  boot(): void | Promise<void> {}

  // If true, this provider is not booted until one of its bindings is resolved.
  deferred: boolean = false

  // If deferred, which bindings trigger loading this provider.
  provides(): (Constructor<any> | symbol)[] { return [] }
}
```

### 5.3 Driver Pattern Contract

Packages that support swappable backends (database, cache, queue, mail, broadcast, session, logging) follow a consistent driver pattern:

```typescript
interface DriverManager<T> {
  driver(name?: string): T              // Get a driver instance by name (default if omitted)
  extend(name: string, factory: () => T): void  // Register a custom driver
  getDefaultDriver(): string            // Returns the configured default driver name
}
```

Each driver implements a package-specific interface (e.g., `CacheDriver`, `QueueDriver`, `MailTransport`). The manager resolves the correct driver from config, caches instances, and allows runtime extension.

### 5.4 Configuration Access Contract

```typescript
interface Config {
  get<T>(key: string, defaultValue?: T): T    // Dot-notation: 'database.connections.sqlite'
  set(key: string, value: any): void
  has(key: string): boolean
  all(): Record<string, any>
}

function config<T>(key: string, defaultValue?: T): T   // Global helper
function env<T>(key: string, defaultValue?: T): T      // Environment variable helper
```

Config files are TypeScript modules in `config/*.ts` that export plain objects. They are loaded once at boot and cached. In production, `mantiq config:cache` serializes the resolved config to a single file for faster boot.

### 5.5 Event Contract

```typescript
interface EventDispatcher {
  emit(event: Event): Promise<void>
  on(eventClass: Constructor<Event>, listener: Constructor<Listener> | EventHandler): void
  forget(eventClass: Constructor<Event>): void
}

type EventHandler = (event: Event) => void | Promise<void>

abstract class Event {
  readonly timestamp: Date = new Date()
}

abstract class Listener {
  abstract handle(event: Event): void | Promise<void>

  // If true, this listener is dispatched to the queue instead of running synchronously.
  shouldQueue: boolean = false
  queue?: string
  connection?: string
}
```

### 5.6 Error Handling Contract

All packages throw errors that extend a base `MantiqError` class. HTTP-facing errors extend `HttpError`.

```typescript
class MantiqError extends Error {
  constructor(message: string, public context?: Record<string, any>) {
    super(message)
  }
}

class HttpError extends MantiqError {
  constructor(
    public statusCode: number,
    message: string,
    public headers?: Record<string, string>,
    context?: Record<string, any>,
  ) {
    super(message, context)
  }
}

// Specific errors
class NotFoundError extends HttpError { statusCode = 404 }
class UnauthorizedError extends HttpError { statusCode = 401 }
class ForbiddenError extends HttpError { statusCode = 403 }
class ValidationError extends HttpError { statusCode = 422; errors: Record<string, string[]> }
class TooManyRequestsError extends HttpError { statusCode = 429; retryAfter?: number }
```

Packages MUST:
- Throw typed errors (never raw `Error` or string throws)
- Include actionable context in the error (what went wrong, what was expected)
- Use `HttpError` subclasses for anything that should produce an HTTP response
- Use `MantiqError` subclasses for internal/non-HTTP errors

### 5.7 Request/Response Contract

```typescript
interface MantiqRequest {
  // Access
  method(): string
  path(): string
  url(): string
  fullUrl(): string
  query(key?: string, defaultValue?: string): string | Record<string, string>
  input(key?: string, defaultValue?: any): any           // Body + query merged
  only(...keys: string[]): Record<string, any>
  except(...keys: string[]): Record<string, any>
  has(...keys: string[]): boolean
  filled(...keys: string[]): boolean

  // Headers & metadata
  header(key: string, defaultValue?: string): string
  headers(): Record<string, string>
  cookie(key: string, defaultValue?: string): string
  ip(): string
  userAgent(): string
  accepts(...types: string[]): string | false
  expectsJson(): boolean
  isJson(): boolean

  // Files
  file(key: string): UploadedFile | null
  files(key: string): UploadedFile[]
  hasFile(key: string): boolean

  // Auth (populated by auth middleware)
  user<T>(): T | null
  isAuthenticated(): boolean

  // Underlying
  raw(): Request  // Bun's native Request object
}

interface MantiqResponse {
  static json(data: any, status?: number): Response
  static html(content: string, status?: number): Response
  static redirect(url: string, status?: number): Response
  static stream(callback: (stream: ReadableStreamController) => void): Response
  static noContent(): Response
  static download(path: string, filename?: string): Response

  // Chainable builder
  status(code: number): MantiqResponse
  header(key: string, value: string): MantiqResponse
  cookie(name: string, value: string, options?: CookieOptions): MantiqResponse
  withHeaders(headers: Record<string, string>): MantiqResponse
}
```

### 5.8 Middleware Contract

```typescript
type NextFunction = () => Promise<Response>

interface Middleware {
  handle(request: MantiqRequest, next: NextFunction): Promise<Response>

  // Optional: runs after the response is sent to the client.
  terminate?(request: MantiqRequest, response: Response): Promise<void>
}
```

Middleware is executed in order. Each middleware calls `next()` to pass to the next middleware or the route handler. A middleware can short-circuit by returning a Response without calling `next()`.

---

## 6. Application Directory Structure

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
│   ├── Channels/
│   ├── Providers/
│   │   ├── AppServiceProvider.ts
│   │   └── RouteServiceProvider.ts
│   └── Services/
├── bootstrap/
│   ├── app.ts              ← Application bootstrap (creates container, registers providers)
│   └── providers.ts        ← Provider list (order matters)
├── config/
│   ├── app.ts
│   ├── auth.ts
│   ├── cors.ts
│   ├── database.ts
│   ├── inertia.ts
│   ├── mail.ts
│   ├── queue.ts
│   ├── cache.ts
│   ├── realtime.ts
│   └── session.ts
├── database/
│   ├── factories/
│   ├── migrations/
│   └── seeders/
├── public/
│   └── index.ts            ← Entry point: boots app, starts Bun.serve()
├── resources/
│   ├── css/
│   └── js/
│       ├── app.tsx          ← Frontend entry point
│       ├── Pages/
│       └── Components/
├── routes/
│   ├── web.ts              ← Routes with session/Inertia middleware
│   ├── api.ts              ← Stateless API routes
│   ├── channels.ts         ← Channel authorization definitions
│   └── console.ts          ← CLI command scheduling
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

## 7. Configuration Defaults

### 7.1 Zero-Config Development

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

### 7.2 Production Recommendations

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

## 8. Global Code Conventions

These conventions apply to ALL packages. AI builders MUST follow these consistently.

### 8.1 File & Naming Conventions

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

### 8.2 Code Style Rules (for AI builders)

- **No `any` in public APIs.** Internal `any` must have a `// @internal` comment justifying it.
- **All public methods must have JSDoc comments** with `@param`, `@returns`, `@throws`, and `@example`.
- **Errors are always typed.** Never `throw new Error(...)` — always a `MantiqError` subclass.
- **Config access is always through the Config contract.** Never `process.env` directly in package code (only in config files).
- **Dependencies are always resolved through the container.** Never direct `import` of another package's implementation — only import interfaces/contracts.
- **All async operations return Promises.** No callbacks.
- **File structure within each package:**
  ```
  packages/<name>/
  ├── src/
  │   ├── index.ts           ← Public API exports
  │   ├── contracts/          ← Interfaces this package defines
  │   ├── drivers/            ← Driver implementations (if applicable)
  │   ├── middleware/          ← Middleware classes (if applicable)
  │   ├── providers/          ← Service provider for this package
  │   ├── errors/             ← Package-specific error classes
  │   └── ...                 ← Implementation files
  ├── tests/
  │   ├── unit/
  │   └── integration/
  ├── package.json
  ├── tsconfig.json
  └── README.md
  ```
- **Every package has a single service provider** that registers all its bindings and boots all its services.
- **Every package exports its contracts (interfaces) separately** from its implementations, so other packages can depend on the contract without coupling to the implementation.

### 8.3 Testing Conventions

- All tests use Bun's native test runner (`bun test`)
- Test files are named `<thing>.test.ts` (unit) or `<thing>.spec.ts` (integration)
- Each package must have >90% line coverage for `src/`
- Integration tests that touch the database use transactions that auto-rollback
- HTTP integration tests use a test application helper that boots the full framework in-memory
- Fakes/mocks for cross-package dependencies: `Queue.fake()`, `Mail.fake()`, `Event.fake()`, `Broadcast.fake()`

---

## 9. Starter Kits

### 9.1 Scaffolding Command

```bash
bunx create-mantiq my-app --ui=react
bunx create-mantiq my-app --ui=vue
bunx create-mantiq my-app --ui=svelte
bunx create-mantiq my-app --ui=vanilla
```

### 9.2 What Each Starter Kit Includes

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
- TypeScript on both sides
- Example pages: Welcome, Dashboard, Login, Register, Forgot Password, Profile
- Shared layout component with navigation
- Form helper components for Inertia forms

### 9.3 Post-Scaffold Experience

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

## 10. Development Phases & Milestones

### Phase 0 — Setup

- [ ] Register npm scope `@mantiq`
- [ ] Create GitHub org `mantiqjs`
- [ ] Secure domain `mantiqjs.com`
- [ ] Initialize monorepo with workspace configuration
- [ ] Set up CI/CD pipeline
- [ ] Configure Bun workspace linking between packages

### Phase 1 — Core Framework (Milestone: "Hello World")

Packages: `@mantiq/core`, `@mantiq/helpers`

- [ ] Service container with typed DI
- [ ] Configuration loader with env integration
- [ ] HTTP kernel wrapping `Bun.serve()`
- [ ] WebSocket kernel hooks (upgrade detection, delegation interface)
- [ ] Request and response objects with helper methods
- [ ] Router with method support, groups, named routes
- [ ] Middleware pipeline with before/after execution
- [ ] Exception handler with dev error page
- [ ] Service provider lifecycle
- [ ] Helpers: Str, Arr, Num, Collection (core methods)

**Gate:** A request hits a route, passes through middleware, reaches a controller, and returns a response. WebSocket upgrades are detected and either delegated or rejected.

### Phase 2 — Data Layer (Milestone: "Real Work")

Packages: `@mantiq/database`

- [ ] Connection manager with SQLite default
- [ ] Query builder with fluent API
- [ ] Migration system with schema builder
- [ ] ORM with model definitions and relationships
- [ ] Eager loading
- [ ] Seeders and factories
- [ ] Pagination

**Gate:** Define a model, run a migration, query data, return it from a controller.

### Phase 3 — Frontend Bridge (Milestone: "Full Stack")

Packages: `@mantiq/inertia`, `@mantiq/vite`

- [ ] Inertia server adapter with full protocol compliance
- [ ] Shared data middleware
- [ ] Inertia response helper
- [ ] Vite+ dev mode integration
- [ ] Vite+ production manifest reading
- [ ] HTML shell renderer

**Gate:** Controller returns `Inertia.render()`, a React/Vue/Svelte page renders in the browser with live database data.

### Phase 4 — Auth & Validation (Milestone: "Production Ready")

Packages: `@mantiq/auth`, `@mantiq/validation`

- [ ] Session authentication (login, logout, remember me)
- [ ] Token authentication for APIs
- [ ] Auth middleware
- [ ] Password hashing
- [ ] Validation rule engine
- [ ] Form request classes
- [ ] CSRF protection

**Gate:** A new user can register, log in, and access protected routes.

### Phase 5 — CLI & Generators (Milestone: "Productive")

Packages: `@mantiq/cli`

- [ ] Command runner with argument parsing
- [ ] All `make:*` generators
- [ ] Database commands (migrate, seed, rollback, status)
- [ ] `mantiq dev` dual server command
- [ ] Route listing
- [ ] Cache/config commands

**Gate:** Developer can scaffold any file type with one command.

### Phase 6 — Starter Kits (Milestone: "Launch Ready")

- [ ] React starter kit with auth pages
- [ ] Vue starter kit with auth pages
- [ ] Svelte starter kit with auth pages
- [ ] Vanilla starter kit
- [ ] `create-mantiq` scaffolding CLI
- [ ] Documentation site at mantiqjs.com

**Gate:** `bunx create-mantiq my-app --ui=react` → working app with auth in under two minutes.

### Phase 7 — Ecosystem

Packages: `@mantiq/queue`, `@mantiq/cache`, `@mantiq/mail`, `@mantiq/events`, `@mantiq/realtime`, `@mantiq/logging`

- [ ] Queue: dispatching, SQLite driver, Redis driver, worker, batching, chaining
- [ ] Cache: memory, file, Redis drivers
- [ ] Mail: SMTP, Resend, Mailgun transports
- [ ] Events: sync dispatch, queueable listeners
- [ ] Realtime: WebSocket, SSE, channels, Echo client
- [ ] Logging: channels, rotation

### Phase 8 — Addons

Packages: `@mantiq/media`, `@mantiq/ai`, `@mantiq/agents`, `@mantiq/search`, `@mantiq/socialise`, `@mantiq/cashier`, `@mantiq/notify`

- [ ] Media: storage abstraction, image processing, media library
- [ ] AI: multi-provider client, completions, embeddings
- [ ] Agents: agent classes, tools, memory, chains, MCP
- [ ] Search: full-text search with multiple backends
- [ ] Socialite: OAuth for major providers
- [ ] Cashier: Stripe/LemonSqueezy subscription management
- [ ] Notify: multi-channel notifications

---

## 11. Technical Constraints

### 11.1 Runtime

- **Bun only.** No Node.js compatibility mode.
- **Minimum Bun version:** Track latest stable. Update minimum quarterly.

### 11.2 Language

- **TypeScript only.** Strict mode enabled everywhere.
- **No `any` in public APIs.**

### 11.3 Dependencies

- Minimize external dependencies. Prefer Bun native APIs.
- No Node.js-specific packages unless Bun provides full compatibility.
- Allowed exceptions: database drivers (pg, mysql2), Sharp (image processing), established utilities.

### 11.4 Performance Targets

- **Cold start:** Under 100ms
- **Request overhead:** Under 1ms per request beyond Bun's raw HTTP
- **Memory:** Base framework under 50MB

### 11.5 Versioning

All core and secondary packages version together (synchronized releases). If `@mantiq/core` is v1.3.0, then `@mantiq/database` is also v1.3.0, even if its code didn't change. This eliminates compatibility guesswork.

Addon packages version independently since they evolve on their own cadence.

---

## 12. Documentation Plan

### 12.1 Structure (mantiqjs.com/docs)

- **Getting Started** — installation, first project, directory structure, core concepts
- **The Basics** — routing, controllers, middleware, requests, responses, views (Inertia)
- **Database** — configuration, query builder, migrations, ORM, relationships, seeding
- **Security** — authentication, authorization, CSRF, encryption, hashing
- **Frontend** — Inertia integration, Vite+ setup, asset handling
- **Advanced** — service container, providers, events, queues, cache, mail, real-time
- **Utilities** — Str, Arr, Num, Collection helpers
- **Addons** — media, AI, agents, search, social auth, billing, notifications
- **Testing** — HTTP tests, database tests, mocking, factories
- **CLI** — commands reference, custom commands, scheduling
- **Deployment** — production config, optimization, Docker, cloud platforms
- **API Reference** — auto-generated from TypeScript types

### 12.2 Principles

- Every feature gets a dedicated page with a complete example
- Copy-paste friendly — code samples should work as-is
- Assumes familiarity with TypeScript but not with Laravel
- Migration guides for developers coming from Laravel, Express/Hono/Elysia

---

## 13. Environment Variables

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

# Mail
MAIL_DRIVER=log

# Redis (when needed)
# REDIS_HOST=127.0.0.1
# REDIS_PORT=6379

# AI (when @mantiq/ai installed)
# AI_PROVIDER=openai
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=

# Vite+
VITE_PORT=5173
```

---

## 14. Comparison with Laravel

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
| Collections            | @mantiq/helpers Collection                  |
| Str/Arr helpers        | @mantiq/helpers Str, Arr, Num               |
| Broadcasting / Echo    | @mantiq/realtime + @mantiq/echo             |
| Laravel Scout          | @mantiq/search                               |
| Laravel Socialite      | @mantiq/socialise                           |
| Laravel Cashier        | @mantiq/cashier                             |
| Laravel Notifications  | @mantiq/notify                              |
| Laravel Forge / Vapor  | — (not in scope)                            |
| PHP                    | TypeScript on Bun                           |

---

## 15. Spec File Index

Each package has its own detailed specification. The master spec (this file) defines how they connect. The package specs define what they do and how they work internally.

| Spec File                          | Status      |
|------------------------------------|-------------|
| [packages/core.md](packages/core.md)           | 📝 To write |
| [packages/database.md](packages/database.md)   | 📝 To write |
| [packages/inertia.md](packages/inertia.md)     | 📝 To write |
| [packages/vite.md](packages/vite.md)           | 📝 To write |
| [packages/auth.md](packages/auth.md)           | 📝 To write |
| [packages/cli.md](packages/cli.md)             | 📝 To write |
| [packages/validation.md](packages/validation.md)| 📝 To write |
| [packages/helpers.md](packages/helpers.md)     | 📝 To write |
| [packages/queue.md](packages/queue.md)         | 📝 To write |
| [packages/cache.md](packages/cache.md)         | 📝 To write |
| [packages/mail.md](packages/mail.md)           | 📝 To write |
| [packages/events.md](packages/events.md)       | 📝 To write |
| [packages/realtime.md](packages/realtime.md)   | 📝 To write |
| [packages/logging.md](packages/logging.md)     | 📝 To write |
| [addons/media.md](addons/media.md)             | 📝 To write |
| [addons/ai.md](addons/ai.md)                   | 📝 To write |
| [addons/agents.md](addons/agents.md)           | 📝 To write |
| [addons/search.md](addons/search.md)             | 📝 To write |
| [addons/socialise.md](addons/socialise.md)     | 📝 To write |
| [addons/cashier.md](addons/cashier.md)         | 📝 To write |
| [addons/notify.md](addons/notify.md)           | 📝 To write |

---

*This is the master specification for MantiqJS. Individual package specs contain implementation-level detail. This document defines the architecture, contracts, and conventions that all packages must follow.*