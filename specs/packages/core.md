# @mantiq/core — Package Specification

> The glue package. Owns the application lifecycle, service container, routing, middleware, HTTP kernel, configuration, and exception handling. Every other package depends on this.

**npm:** `@mantiq/core`
**Dependencies:** None (Bun APIs only)
**Dependents:** All other @mantiq/* packages

---

## 1. Package Structure

```
packages/core/
├── src/
│   ├── index.ts                    ← Public API exports
│   ├── contracts/
│   │   ├── Container.ts            ← Container interface
│   │   ├── Config.ts               ← Config interface
│   │   ├── Middleware.ts           ← Middleware interface
│   │   ├── ServiceProvider.ts      ← ServiceProvider base class
│   │   ├── Request.ts              ← MantiqRequest interface
│   │   ├── Response.ts             ← MantiqResponse interface
│   │   ├── Router.ts               ← Router interface
│   │   ├── ExceptionHandler.ts     ← ExceptionHandler interface
│   │   ├── DriverManager.ts        ← DriverManager interface
│   │   └── EventDispatcher.ts      ← EventDispatcher interface (contract only)
│   ├── container/
│   │   ├── Container.ts            ← Container implementation
│   │   └── ContextualBindingBuilder.ts
│   ├── config/
│   │   ├── ConfigRepository.ts     ← Config implementation
│   │   └── env.ts                  ← env() helper
│   ├── http/
│   │   ├── Kernel.ts               ← HTTP kernel (wraps Bun.serve)
│   │   ├── Request.ts              ← MantiqRequest implementation
│   │   ├── Response.ts             ← MantiqResponse implementation
│   │   ├── UploadedFile.ts
│   │   └── Cookie.ts
│   ├── routing/
│   │   ├── Router.ts               ← Router implementation
│   │   ├── Route.ts                ← Single route definition
│   │   ├── RouteGroup.ts           ← Group builder
│   │   ├── RouteCollection.ts      ← Stores all registered routes
│   │   ├── RouteMatcher.ts         ← URL matching engine
│   │   └── ResourceRegistrar.ts    ← Generates CRUD routes
│   ├── middleware/
│   │   ├── Pipeline.ts             ← Middleware execution pipeline
│   │   ├── Cors.ts                 ← Built-in CORS middleware
│   │   └── TrimStrings.ts          ← Built-in input trimming
│   ├── errors/
│   │   ├── MantiqError.ts          ← Base error class
│   │   ├── HttpError.ts            ← HTTP error base
│   │   ├── NotFoundError.ts
│   │   ├── UnauthorizedError.ts
│   │   ├── ForbiddenError.ts
│   │   ├── ValidationError.ts
│   │   └── TooManyRequestsError.ts
│   ├── exceptions/
│   │   ├── Handler.ts              ← Default exception handler
│   │   └── DevErrorPage.ts         ← HTML error page for development
│   ├── providers/
│   │   └── CoreServiceProvider.ts
│   ├── websocket/
│   │   ├── WebSocketKernel.ts      ← WS upgrade handling
│   │   └── WebSocketContext.ts     ← Per-connection context
│   └── helpers/
│       ├── abort.ts                ← abort(404), abort(403, 'msg')
│       ├── config.ts               ← config() global helper
│       ├── env.ts                  ← env() global helper
│       ├── app.ts                  ← app() container access
│       └── route.ts                ← route() URL generation
├── tests/
│   ├── unit/
│   │   ├── container.test.ts
│   │   ├── config.test.ts
│   │   ├── router.test.ts
│   │   ├── middleware.test.ts
│   │   ├── request.test.ts
│   │   └── response.test.ts
│   └── integration/
│       ├── http-lifecycle.spec.ts
│       ├── routing.spec.ts
│       └── error-handling.spec.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## 2. Service Container

### 2.1 Interface

```typescript
interface Container {
  /**
   * Register a transient binding. A new instance is created each time.
   * @param abstract - The interface/class/symbol to bind
   * @param concrete - The implementation class or factory function
   */
  bind<T>(abstract: Bindable<T>, concrete: Resolvable<T>): void

  /**
   * Register a singleton binding. Created once, cached forever.
   * @param abstract - The interface/class/symbol to bind
   * @param concrete - The implementation class or factory function
   */
  singleton<T>(abstract: Bindable<T>, concrete: Resolvable<T>): void

  /**
   * Register an existing instance as a singleton.
   * @param abstract - The interface/class/symbol to bind
   * @param instance - The pre-created instance
   */
  instance<T>(abstract: Bindable<T>, instance: T): void

  /**
   * Resolve a binding from the container.
   * @param abstract - The interface/class/symbol to resolve
   * @returns The resolved instance
   * @throws ContainerResolutionError if the binding doesn't exist and can't be auto-resolved
   */
  make<T>(abstract: Bindable<T>): T

  /**
   * Resolve a binding, or return the default if not bound.
   */
  makeOrDefault<T>(abstract: Bindable<T>, defaultValue: T): T

  /**
   * Check if a binding exists.
   */
  has(abstract: Bindable<any>): boolean

  /**
   * Start building a contextual binding.
   * Usage: container.when(UserController).needs(Logger).give(UserLogger)
   */
  when(concrete: Constructor<any>): ContextualBindingBuilder

  /**
   * Register an alias for an abstract.
   */
  alias(abstract: Bindable<any>, alias: string | symbol): void

  /**
   * Remove all bindings and cached instances.
   */
  flush(): void

  /**
   * Call a method on an object, injecting its dependencies.
   */
  call<T>(target: object, method: string, extraParams?: Record<string, any>): T
}

type Bindable<T> = Constructor<T> | symbol | string
type Resolvable<T> = Constructor<T> | ((container: Container) => T)
type Constructor<T> = new (...args: any[]) => T

interface ContextualBindingBuilder {
  needs<T>(abstract: Bindable<T>): { give<U extends T>(concrete: Resolvable<U>): void }
}
```

### 2.2 Behavior

**Auto-resolution:** If `make()` is called for a class that has no explicit binding, the container attempts to auto-resolve it by inspecting the constructor parameters' types and recursively resolving each dependency. This uses TypeScript's emitted metadata (requires `"emitDecoratorMetadata": true` in tsconfig) or explicit parameter type annotations.

**Singleton lifecycle:** Singletons are created on first `make()` call and the same instance is returned for all subsequent calls. Calling `flush()` clears all singleton instances.

**Contextual binding example:**
```typescript
container.when(UserController).needs(CacheDriver).give(RedisCacheDriver)
container.when(AdminController).needs(CacheDriver).give(MemoryCacheDriver)
```
When `UserController` is resolved and it depends on `CacheDriver`, it gets `RedisCacheDriver`. When `AdminController` is resolved, it gets `MemoryCacheDriver`.

**Factory bindings:**
```typescript
container.bind(DatabaseConnection, (c) => {
  const config = c.make(Config)
  return new SQLiteConnection(config.get('database.path'))
})
```

### 2.3 Errors

```typescript
class ContainerResolutionError extends MantiqError {
  constructor(
    public abstract: Bindable<any>,
    public reason: 'not_bound' | 'circular_dependency' | 'unresolvable_parameter',
    public details?: string, // e.g., "Parameter 'logger' in UserService constructor could not be resolved"
  ) {
    super(`Cannot resolve ${String(abstract)}: ${reason}. ${details ?? ''}`)
  }
}
```

### 2.4 Tests

| Test | Description |
|------|-------------|
| `bind-and-resolve` | Bind a class, resolve it, verify it's the correct instance |
| `singleton-returns-same-instance` | Bind as singleton, resolve twice, verify `===` |
| `transient-returns-new-instance` | Bind as transient, resolve twice, verify `!==` |
| `auto-resolution` | Resolve a class with no explicit binding, verify constructor deps are injected |
| `factory-binding` | Bind with a factory function, verify the factory is called with the container |
| `contextual-binding` | Verify different implementations resolve based on the consuming class |
| `instance-binding` | Register a pre-created instance, verify it's returned as-is |
| `alias-resolution` | Create an alias, resolve by alias, verify correct instance |
| `circular-dependency-detection` | A depends on B, B depends on A → throws `ContainerResolutionError` with `circular_dependency` |
| `unresolvable-throws` | Resolve a class with an unresolvable primitive parameter → throws with `unresolvable_parameter` |
| `flush-clears-singletons` | Bind singleton, resolve, flush, resolve again → new instance |
| `has-returns-false` | Check `has()` for unbound abstract → `false` |
| `has-returns-true` | Bind, check `has()` → `true` |

---

## 3. Configuration

### 3.1 Interface

```typescript
interface Config {
  /**
   * Get a config value using dot-notation.
   * @param key - Dot-notation key: 'database.connections.sqlite.path'
   * @param defaultValue - Returned if key doesn't exist
   * @throws ConfigKeyNotFoundError if key doesn't exist and no default provided
   */
  get<T = any>(key: string, defaultValue?: T): T

  /**
   * Set a config value at runtime (not persisted).
   */
  set(key: string, value: any): void

  /**
   * Check if a key exists.
   */
  has(key: string): boolean

  /**
   * Get all config as a flat object.
   */
  all(): Record<string, any>
}
```

### 3.2 Loading Behavior

1. On boot, the config loader reads all `.ts` files in the `config/` directory.
2. Each file is imported dynamically: `await import(configPath)`.
3. The default export of each file becomes a top-level config key (filename without extension).
4. Example: `config/database.ts` exports `{ connections: { sqlite: { path: '...' } } }` → accessible as `config('database.connections.sqlite.path')`.
5. Environment variables are resolved at config load time via the `env()` helper used inside config files.

### 3.3 env() Helper

```typescript
/**
 * Read an environment variable with type coercion.
 * @param key - The env var name
 * @param defaultValue - Returned if the env var is not set
 *
 * Type coercion rules:
 * - 'true' / 'false' → boolean
 * - '(empty)' → '' (empty string, not undefined)
 * - Numeric strings → remain strings (no auto-coercion to number)
 * - undefined → defaultValue
 */
function env<T = string>(key: string, defaultValue?: T): T
```

Reads from `process.env` (Bun loads `.env` files automatically).

### 3.4 config() Global Helper

```typescript
/**
 * Access config from anywhere in the application.
 * Resolves the Config instance from the container.
 *
 * @example config('app.name')
 * @example config('database.connections.sqlite.path', '/default/path.db')
 */
function config<T = any>(key: string, defaultValue?: T): T
```

### 3.5 Config Caching

`mantiq config:cache` serializes the fully resolved config (all env vars resolved, all files merged) into `bootstrap/cache/config.json`. On boot, if this file exists, the config loader reads it instead of importing individual config files. This eliminates file I/O and dynamic imports in production.

`mantiq config:clear` deletes the cached file.

### 3.6 Errors

```typescript
class ConfigKeyNotFoundError extends MantiqError {
  constructor(public key: string) {
    super(`Config key '${key}' not found and no default value provided.`)
  }
}
```

### 3.7 Tests

| Test | Description |
|------|-------------|
| `get-nested-value` | Set config `{ a: { b: { c: 1 } } }`, get `'a.b.c'` → `1` |
| `get-with-default` | Get non-existent key with default → returns default |
| `get-without-default-throws` | Get non-existent key without default → throws `ConfigKeyNotFoundError` |
| `set-and-get` | Set a value, get it back → matches |
| `set-nested-creates-path` | Set `'a.b.c'` on empty config → creates nested structure |
| `has-existing-key` | `has('a.b')` on existing → `true` |
| `has-missing-key` | `has('x.y')` → `false` |
| `env-boolean-coercion` | `env('VAR')` where VAR='true' → `true` (boolean) |
| `env-default-value` | `env('MISSING', 'fallback')` → `'fallback'` |
| `env-empty-string` | `env('VAR')` where VAR='' → `''` (not undefined) |
| `load-config-files` | Place files in config/, boot, verify all accessible |

---

## 4. HTTP Kernel

### 4.1 Boot Sequence

When the application starts (`public/index.ts`):

```
1. Create Container instance
2. Register core bindings (Container, Config, etc.)
3. Load config files (or cached config)
4. Read provider list from bootstrap/providers.ts
5. Instantiate all providers, call register() in order
6. Call boot() on all providers in order
7. Start Bun.serve() with the HTTP kernel's fetch handler
```

### 4.2 Request Lifecycle

```
Incoming HTTP Request (Bun.serve fetch callback)
    │
    ▼
Is WebSocket upgrade? ──yes──▶ WebSocket Kernel (section 8)
    │ no
    ▼
Create MantiqRequest from Bun Request
    │
    ▼
Run global middleware pipeline (before)
    │
    ▼
Match route (Router)
    │
    ├── No match → throw NotFoundError
    │
    ▼
Run route-level middleware pipeline (before)
    │
    ▼
Resolve controller from container
    │
    ▼
Call controller method (inject dependencies)
    │
    ▼
Controller returns Response (or value that is converted to Response)
    │
    ▼
Run route-level middleware pipeline (after)
    │
    ▼
Run global middleware pipeline (after)
    │
    ▼
Send Response to client
    │
    ▼
Run terminable middleware (after response sent)
```

### 4.3 Kernel Implementation

```typescript
class HttpKernel {
  constructor(
    private container: Container,
    private router: Router,
    private pipeline: Pipeline,
    private exceptionHandler: ExceptionHandler,
  ) {}

  /**
   * The fetch handler passed to Bun.serve().
   * This is the entry point for every HTTP request.
   */
  async handle(bunRequest: Request, server: Server): Promise<Response> {
    // Check for WebSocket upgrade
    if (bunRequest.headers.get('upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(bunRequest, server)
    }

    const request = MantiqRequest.fromBun(bunRequest)

    try {
      // Run global middleware, then route middleware, then controller
      const response = await this.pipeline
        .send(request)
        .through(this.globalMiddleware)
        .then(async (request) => {
          const match = this.router.match(request)
          return this.pipeline
            .send(request)
            .through(match.middleware)
            .then(() => this.callController(match, request))
        })

      return this.prepareResponse(response)
    } catch (error) {
      return this.exceptionHandler.render(request, error)
    }
  }

  /**
   * Start the server.
   */
  async start(): Promise<void> {
    const port = config('app.port', 3000)

    Bun.serve({
      port,
      fetch: (req, server) => this.handle(req, server),
      websocket: this.getWebSocketHandlers(), // Always registered, delegates to realtime package if installed
    })
  }
}
```

### 4.4 Controller Return Value Handling

Controllers can return various types. The kernel converts them to `Response`:

| Return Type | Conversion |
|-------------|------------|
| `Response` (native) | Used as-is |
| `MantiqResponse` | Converted to native Response |
| `string` | `Response` with `text/html` content type |
| `object` / `array` | `Response.json()` |
| `null` / `undefined` | 204 No Content |
| `InertiaResponse` | Handled by Inertia adapter (see @mantiq/inertia spec) |

---

## 5. Request

### 5.1 Interface

Full interface defined in Master Spec section 5.7.

### 5.2 Construction

```typescript
class MantiqRequest implements MantiqRequestInterface {
  private parsedBody: Record<string, any> | null = null
  private parsedQuery: Record<string, string> | null = null
  private routeParams: Record<string, any> = {}
  private authenticatedUser: any = null

  constructor(private bunRequest: Request, private bunUrl: URL) {}

  /**
   * Create from a Bun Request.
   * Parses the URL once and caches it.
   */
  static fromBun(request: Request): MantiqRequest {
    const url = new URL(request.url)
    return new MantiqRequest(request, url)
  }

  /**
   * Body parsing is lazy — only parsed on first access.
   * Supports: application/json, application/x-www-form-urlencoded, multipart/form-data
   */
  async input(key?: string, defaultValue?: any): Promise<any> {
    if (!this.parsedBody) {
      this.parsedBody = await this.parseBody()
    }
    if (!key) return { ...this.parsedQuery, ...this.parsedBody }
    return this.parsedBody[key] ?? this.parsedQuery?.[key] ?? defaultValue
  }
}
```

### 5.3 Body Parsing Rules

| Content-Type | Parsing Strategy |
|-------------|------------------|
| `application/json` | `await request.json()` |
| `application/x-www-form-urlencoded` | `new URLSearchParams(await request.text())` → object |
| `multipart/form-data` | `await request.formData()` → separate files into `UploadedFile` objects |
| Other / missing | `null` body — `input()` returns only query params |

### 5.4 UploadedFile

```typescript
class UploadedFile {
  constructor(
    private file: File, // Bun's native File from FormData
  ) {}

  name(): string                    // Original filename
  extension(): string               // File extension
  mimeType(): string                // MIME type
  size(): number                    // Size in bytes
  isValid(): boolean                // File was uploaded without errors
  async store(path: string, options?: { disk?: string }): Promise<string>  // Store and return path
  async bytes(): Promise<Uint8Array>
  async text(): Promise<string>
  async stream(): ReadableStream
}
```

---

## 6. Response

### 6.1 Static Factories

```typescript
class MantiqResponse {
  static json(data: any, status: number = 200, headers?: Record<string, string>): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    })
  }

  static html(content: string, status: number = 200): Response {
    return new Response(content, {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  static redirect(url: string, status: number = 302): Response {
    return new Response(null, {
      status,
      headers: { Location: url },
    })
  }

  static noContent(): Response {
    return new Response(null, { status: 204 })
  }

  static stream(callback: (controller: ReadableStreamDefaultController) => void | Promise<void>): Response {
    const stream = new ReadableStream({ start: callback })
    return new Response(stream)
  }

  static download(content: Uint8Array | string, filename: string, mimeType?: string): Response {
    return new Response(content, {
      headers: {
        'Content-Type': mimeType ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }
}
```

### 6.2 Builder Pattern (for middleware use)

```typescript
class ResponseBuilder {
  private statusCode: number = 200
  private responseHeaders: Record<string, string> = {}
  private cookies: CookieJar = new CookieJar()

  status(code: number): this { this.statusCode = code; return this }
  header(key: string, value: string): this { this.responseHeaders[key] = value; return this }
  cookie(name: string, value: string, options?: CookieOptions): this { this.cookies.set(name, value, options); return this }
  withHeaders(headers: Record<string, string>): this { Object.assign(this.responseHeaders, headers); return this }

  json(data: any): Response { /* applies status, headers, cookies, returns Response */ }
  html(content: string): Response { /* applies status, headers, cookies, returns Response */ }
  redirect(url: string): Response { /* applies cookies, returns Response */ }
}
```

---

## 7. Router

### 7.1 Route Registration API

```typescript
interface Router {
  // HTTP methods
  get(path: string, action: RouteAction): Route
  post(path: string, action: RouteAction): Route
  put(path: string, action: RouteAction): Route
  patch(path: string, action: RouteAction): Route
  delete(path: string, action: RouteAction): Route
  options(path: string, action: RouteAction): Route

  // Match any/multiple methods
  match(methods: HttpMethod[], path: string, action: RouteAction): Route
  any(path: string, action: RouteAction): Route

  // Resource routes (generates GET index, GET show, POST store, PUT update, DELETE destroy, GET create, GET edit)
  resource(name: string, controller: Constructor<any>): void

  // API resource routes (same as resource but without create/edit — those are frontend concerns)
  apiResource(name: string, controller: Constructor<any>): void

  // Groups
  group(options: RouteGroupOptions, callback: (router: Router) => void): void

  // URL generation
  url(name: string, params?: Record<string, any>): string

  // Route matching
  match(request: MantiqRequest): RouteMatch

  // Get all registered routes (for route:list command)
  routes(): RouteCollection
}

type RouteAction =
  | [Constructor<any>, string]           // [ControllerClass, 'method']
  | ((request: MantiqRequest) => any)    // Closure

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

interface RouteGroupOptions {
  prefix?: string          // URL prefix: '/admin'
  middleware?: string[]    // Middleware aliases: ['auth', 'throttle:60']
  namespace?: string       // Controller namespace prefix
  as?: string              // Route name prefix: 'admin.'
}
```

### 7.2 Route Definition

```typescript
class Route {
  constructor(
    public method: HttpMethod | HttpMethod[],
    public path: string,              // e.g., '/users/:id'
    public action: RouteAction,
  ) {}

  // Fluent configuration
  name(name: string): this                                    // Named route: route('users.show', { id: 1 })
  middleware(...middleware: string[]): this                     // Apply middleware
  where(param: string, pattern: string | RegExp): this        // Constrain a parameter
  whereNumber(param: string): this                            // Shorthand: param must be numeric
  whereAlpha(param: string): this                             // Shorthand: param must be alphabetic
  whereUuid(param: string): this                              // Shorthand: param must be UUID
}
```

### 7.3 Route Matching Algorithm

1. Routes are stored in a `RouteCollection`, indexed by HTTP method for O(1) method filtering.
2. For each route matching the HTTP method, test the URL pattern:
   - Static segments match exactly.
   - `:param` segments match any non-empty segment and capture the value.
   - `:param?` optional segments match an empty or present segment.
   - `*` wildcard matches the rest of the path (only at the end).
3. Parameter constraints (`.where()`) are tested after a match is found. If a constraint fails, matching continues to the next candidate.
4. First matching route wins (order of registration matters).
5. If no route matches, throw `NotFoundError`.

**Parameter type coercion:**
- If `.whereNumber()` is set, the captured parameter is coerced to `number`.
- All other parameters are `string` by default.

### 7.4 Route Model Binding

When a route parameter name matches a model name (e.g., `:user` → `User` model), the framework can auto-resolve the model from the database.

**Registration:**
```typescript
// In RouteServiceProvider.boot()
router.model('user', User)   // :user parameter → User.findOrFail(value)
```

**Behavior:**
1. On route match, check if any parameter has a registered model binding.
2. If yes, resolve the model: `await Model.findOrFail(paramValue)`.
3. If the model is not found, throw `NotFoundError` (404).
4. The resolved model instance is injected into the controller method.

**Customization:**
```typescript
router.bind('user', async (value) => {
  return await User.where('slug', value).firstOrFail()  // Bind by slug instead of ID
})
```

### 7.5 Resource Route Generation

`router.resource('photos', PhotoController)` generates:

| Method | URI | Controller Method | Route Name |
|--------|-----|-------------------|------------|
| GET | `/photos` | `index` | `photos.index` |
| GET | `/photos/create` | `create` | `photos.create` |
| POST | `/photos` | `store` | `photos.store` |
| GET | `/photos/:photo` | `show` | `photos.show` |
| GET | `/photos/:photo/edit` | `edit` | `photos.edit` |
| PUT/PATCH | `/photos/:photo` | `update` | `photos.update` |
| DELETE | `/photos/:photo` | `destroy` | `photos.destroy` |

`router.apiResource('photos', PhotoController)` generates the same without `create` and `edit` (those are frontend pages, not API endpoints).

### 7.6 URL Generation

```typescript
// Given: router.get('/users/:id', [UserController, 'show']).name('users.show')

route('users.show', { id: 42 })           // → '/users/42'
route('users.show', { id: 42 }, true)     // → 'http://localhost:3000/users/42' (absolute)
```

If a required parameter is missing, throw `MantiqError` with a clear message: `"Missing required parameter 'id' for route 'users.show'."`.

### 7.7 Tests

| Test | Description |
|------|-------------|
| `match-static-route` | Register `GET /about`, request `/about` → matches |
| `match-parameterized-route` | Register `GET /users/:id`, request `/users/42` → matches, `id` = `'42'` |
| `match-optional-param` | Register `GET /posts/:slug?`, request `/posts` → matches, `slug` = `undefined` |
| `match-wildcard` | Register `GET /files/*`, request `/files/a/b/c` → matches, wildcard = `'a/b/c'` |
| `no-match-throws-404` | Request unregistered path → throws `NotFoundError` |
| `method-mismatch-throws-405` | Register `GET /users`, request `POST /users` → throws `HttpError(405)` with `Allow` header |
| `parameter-constraint` | Register with `.whereNumber('id')`, request `/users/abc` → no match, `/users/42` → matches |
| `named-route-url` | Register named route, call `route('name', params)` → correct URL |
| `missing-param-throws` | Call `route('name')` without required param → throws with clear message |
| `route-group-prefix` | Group with `prefix: '/admin'`, register `GET /users` → matches `/admin/users` |
| `route-group-middleware` | Group with `middleware: ['auth']`, verify middleware applied to all routes in group |
| `resource-routes` | Register `resource('photos', Controller)`, verify all 7 routes exist with correct methods and names |
| `api-resource-routes` | Register `apiResource('photos', Controller)`, verify 5 routes (no create/edit) |
| `route-model-binding` | Register model binding, request with ID → controller receives model instance |
| `route-model-binding-not-found` | Request with non-existent ID → 404 |
| `first-match-wins` | Register two routes that could match, verify first one wins |

---

## 8. Middleware Pipeline

### 8.1 Implementation

```typescript
class Pipeline {
  private passable: MantiqRequest
  private pipes: Constructor<Middleware>[] = []

  send(request: MantiqRequest): this {
    this.passable = request
    return this
  }

  through(middleware: Constructor<Middleware>[]): this {
    this.pipes = middleware
    return this
  }

  async then(destination: (request: MantiqRequest) => Promise<Response>): Promise<Response> {
    // Build the middleware chain from inside out
    // Last middleware calls destination, second-to-last calls last, etc.
    const pipeline = this.pipes.reduceRight(
      (next: NextFunction, middlewareClass: Constructor<Middleware>) => {
        return async () => {
          const middleware = this.container.make(middlewareClass)
          return middleware.handle(this.passable, next)
        }
      },
      () => destination(this.passable),
    )

    return pipeline()
  }
}
```

### 8.2 Middleware Aliases

Middleware is referenced by alias in route definitions. Aliases are registered in the HTTP kernel or a service provider.

```typescript
// Registered aliases
const middlewareAliases: Record<string, Constructor<Middleware>> = {
  'auth': AuthenticateMiddleware,
  'guest': RedirectIfAuthenticatedMiddleware,
  'cors': CorsMiddleware,
  'throttle': ThrottleMiddleware,
  'csrf': VerifyCsrfTokenMiddleware,
  'trim': TrimStringsMiddleware,
}
```

### 8.3 Middleware Parameters

Middleware aliases can include parameters after a colon:
- `'throttle:60,1'` → `ThrottleMiddleware` receives `['60', '1']` as parameters
- Parameters are passed as a second argument to `handle()` or set on the middleware instance before `handle()` is called

```typescript
// Resolution of 'throttle:60,1':
const [alias, ...params] = 'throttle:60,1'.split(':')
const paramList = params.join(':').split(',') // ['60', '1']
const middleware = container.make(middlewareAliases[alias])
middleware.setParameters(paramList) // or pass to handle()
```

### 8.4 Terminable Middleware

If a middleware class has a `terminate()` method, it is called after the response has been sent to the client. This is useful for logging, analytics, or cleanup that shouldn't delay the response.

```typescript
class LogRequestMiddleware implements Middleware {
  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    const start = performance.now()
    const response = await next()
    // Don't log here — log in terminate() so it doesn't block the response
    return response
  }

  async terminate(request: MantiqRequest, response: Response): Promise<void> {
    const duration = performance.now() - this.startTime
    logger.info(`${request.method()} ${request.path()} → ${response.status} (${duration}ms)`)
  }
}
```

### 8.5 Tests

| Test | Description |
|------|-------------|
| `executes-in-order` | Register middleware A, B, C → verify A runs before B before C |
| `short-circuit` | Middleware A returns Response without calling `next()` → B and C never run |
| `modify-request` | Middleware adds data to request → controller sees the modification |
| `modify-response` | Middleware wraps `next()`, modifies the returned Response |
| `terminable-runs-after-response` | Middleware with `terminate()` → verify it runs after response is returned |
| `middleware-parameters` | Alias `'throttle:60'` → middleware receives `['60']` |
| `dependency-injection` | Middleware constructor has dependencies → they're resolved from container |

---

## 9. Exception Handler

### 9.1 Interface

```typescript
abstract class ExceptionHandler {
  /**
   * Report the exception (log it, send to error tracker, etc.).
   * Called for every exception unless it's in the ignore list.
   */
  abstract report(error: Error): Promise<void>

  /**
   * Render the exception as an HTTP response.
   */
  abstract render(request: MantiqRequest, error: Error): Response

  /**
   * Exception classes that should not be reported.
   */
  dontReport: Constructor<Error>[] = [
    NotFoundError,
    ValidationError,
    UnauthorizedError,
  ]
}
```

### 9.2 Default Handler Behavior

```
Exception caught
    │
    ▼
Is it in dontReport? ──yes──▶ Skip reporting
    │ no
    ▼
Call report() → log error with full context
    │
    ▼
Call render()
    │
    ├── Is APP_DEBUG=true?
    │   │ yes
    │   ▼
    │   Return DevErrorPage (HTML with stack trace, request dump, config, route info)
    │
    ├── Does request expect JSON? (API route or Accept: application/json)
    │   │ yes
    │   ▼
    │   Return JSON: { error: { message, status, ...(debug ? { trace } : {}) } }
    │
    ▼
    Return generic HTML error page (404, 500, etc.)
```

### 9.3 Dev Error Page

When `APP_DEBUG=true`, unhandled errors render a detailed HTML page containing:

- **Error message and class name** — prominently displayed
- **Stack trace** — with source code snippets for each frame (read from filesystem)
- **Request details** — method, URL, headers, body, query params, cookies
- **Route info** — matched route, parameters, middleware stack
- **Application info** — MantiqJS version, Bun version, environment
- **Config excerpt** — relevant config values (with sensitive values masked)

The dev error page is a self-contained HTML file (inline CSS, no external dependencies).

### 9.4 abort() Helper

```typescript
/**
 * Throw an HTTP exception from anywhere.
 * @throws HttpError
 */
function abort(status: number, message?: string, headers?: Record<string, string>): never {
  throw new HttpError(status, message ?? defaultMessageForStatus(status), headers)
}

// Usage in controllers:
abort(404)                           // → NotFoundError
abort(403, 'You cannot edit this')   // → ForbiddenError
abort(429, 'Slow down', { 'Retry-After': '60' })
```

### 9.5 Tests

| Test | Description |
|------|-------------|
| `http-error-renders-status` | Throw `HttpError(404)` → response has status 404 |
| `validation-error-renders-422` | Throw `ValidationError` → response has status 422 with error details |
| `debug-mode-shows-stack` | `APP_DEBUG=true`, throw error → response contains stack trace |
| `production-hides-stack` | `APP_DEBUG=false`, throw error → response has generic message, no stack |
| `json-error-for-api` | Request with `Accept: application/json`, throw error → JSON response |
| `dont-report-skips-logging` | Throw `NotFoundError` → `report()` is not called |
| `report-called-for-unknown` | Throw unknown error → `report()` is called |
| `abort-helper` | Call `abort(403)` → throws `HttpError` with status 403 |

---

## 10. WebSocket Kernel

### 10.1 Purpose

The WebSocket kernel provides the upgrade detection and lifecycle hooks that `@mantiq/realtime` plugs into. The core package does NOT implement channel logic, broadcasting, or pub/sub — it only provides the infrastructure for the realtime package to register itself.

### 10.2 Upgrade Handling

```typescript
class WebSocketKernel {
  private handler: WebSocketHandler | null = null

  /**
   * Called by @mantiq/realtime service provider to register its handler.
   */
  registerHandler(handler: WebSocketHandler): void {
    this.handler = handler
  }

  /**
   * Called by HTTP kernel when an upgrade request is detected.
   */
  async handleUpgrade(request: Request, server: Server): Promise<Response> {
    if (!this.handler) {
      return new Response('WebSocket not available', { status: 426 })
    }

    // Run upgrade middleware (authentication, etc.)
    const mantiqRequest = MantiqRequest.fromBun(request)
    const context = await this.handler.onUpgrade(mantiqRequest)

    if (!context) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Upgrade the connection
    const upgraded = server.upgrade(request, { data: context })
    if (!upgraded) {
      return new Response('Upgrade failed', { status: 500 })
    }

    return undefined as any // Bun handles the upgrade; no Response needed
  }
}
```

### 10.3 WebSocket Handler Contract

```typescript
interface WebSocketHandler {
  /**
   * Called before the WebSocket upgrade. Return context data to attach to the connection,
   * or null to reject the upgrade.
   */
  onUpgrade(request: MantiqRequest): Promise<WebSocketContext | null>

  /**
   * Bun WebSocket lifecycle handlers.
   * These are passed to Bun.serve({ websocket: { ... } }).
   */
  open(ws: ServerWebSocket<WebSocketContext>): void | Promise<void>
  message(ws: ServerWebSocket<WebSocketContext>, message: string | Buffer): void | Promise<void>
  close(ws: ServerWebSocket<WebSocketContext>, code: number, reason: string): void | Promise<void>
  drain(ws: ServerWebSocket<WebSocketContext>): void | Promise<void>
}

interface WebSocketContext {
  userId?: string | number
  channels: Set<string>
  metadata: Record<string, any>
}
```

### 10.4 Tests

| Test | Description |
|------|-------------|
| `no-handler-returns-426` | No realtime package registered, WS upgrade request → 426 response |
| `handler-registered-delegates` | Register handler, WS upgrade → `onUpgrade` is called |
| `upgrade-rejected-returns-401` | Handler's `onUpgrade` returns null → 401 response |
| `upgrade-accepted` | Handler's `onUpgrade` returns context → upgrade succeeds |

---

## 11. Service Provider Lifecycle

### 11.1 Provider Base Class

```typescript
abstract class ServiceProvider {
  constructor(protected app: Container) {}

  /**
   * Register bindings in the container.
   * Called for ALL providers before any boot() methods are called.
   * Do NOT resolve dependencies here.
   */
  register(): void | Promise<void> {}

  /**
   * Boot the service. Called after all providers are registered.
   * Safe to resolve dependencies from the container.
   */
  boot(): void | Promise<void> {}

  /**
   * If true, this provider is lazy-loaded.
   * It's registered but not booted until one of its bindings is first resolved.
   */
  deferred: boolean = false

  /**
   * The bindings this provider offers (for deferred loading).
   */
  provides(): Bindable<any>[] { return [] }
}
```

### 11.2 Provider Registration Process

```
1. Read bootstrap/providers.ts → array of provider classes
2. For each provider class:
   a. Instantiate: new Provider(container)
   b. If deferred: store it, skip to next. Will register+boot on first resolution of its bindings.
   c. If not deferred: call provider.register()
3. After ALL non-deferred providers are registered:
   For each non-deferred provider:
   a. Call provider.boot()
4. Application is now ready to handle requests.
```

### 11.3 Deferred Provider Resolution

When `container.make()` is called for a binding that no registered provider offers:
1. Check if any deferred provider's `provides()` includes this binding.
2. If yes: `register()` the provider, then `boot()` it, then retry `make()`.
3. If no: throw `ContainerResolutionError`.

### 11.4 Tests

| Test | Description |
|------|-------------|
| `register-before-boot` | All `register()` calls complete before any `boot()` call |
| `boot-can-resolve` | In `boot()`, `container.make()` succeeds for bindings from other providers |
| `register-cannot-resolve` | In `register()`, resolving another provider's binding fails or returns undefined |
| `deferred-not-booted-early` | Deferred provider's `boot()` is not called during application startup |
| `deferred-loads-on-resolve` | `make()` for a deferred binding triggers `register()` + `boot()` of its provider |

---

## 12. Core Service Provider

The `CoreServiceProvider` is the first provider loaded. It registers the fundamental bindings.

```typescript
class CoreServiceProvider extends ServiceProvider {
  register() {
    this.app.instance(Container, this.app)     // Container is always available
    this.app.singleton(Config, ConfigRepository)
    this.app.singleton(Router, RouterImpl)
    this.app.singleton(HttpKernel, HttpKernel)
    this.app.singleton(WebSocketKernel, WebSocketKernel)
    this.app.singleton(ExceptionHandler, DefaultExceptionHandler)
    this.app.singleton(Pipeline, Pipeline)
  }

  boot() {
    // Load route files
    const router = this.app.make(Router)
    // routes/web.ts and routes/api.ts are loaded here
  }
}
```

---

## 13. Exports

`packages/core/src/index.ts` exports:

```typescript
// Contracts (interfaces)
export type { Container, Bindable, Resolvable, Constructor } from './contracts/Container'
export type { Config } from './contracts/Config'
export type { Middleware, NextFunction } from './contracts/Middleware'
export type { MantiqRequest } from './contracts/Request'
export type { MantiqResponse } from './contracts/Response'
export type { Router, Route, RouteAction, RouteGroupOptions } from './contracts/Router'
export type { ExceptionHandler } from './contracts/ExceptionHandler'
export type { DriverManager } from './contracts/DriverManager'
export type { EventDispatcher } from './contracts/EventDispatcher'
export type { WebSocketHandler, WebSocketContext } from './websocket/WebSocketContext'

// Base classes
export { ServiceProvider } from './contracts/ServiceProvider'
export { MantiqError } from './errors/MantiqError'
export { HttpError } from './errors/HttpError'
export { NotFoundError } from './errors/NotFoundError'
export { UnauthorizedError } from './errors/UnauthorizedError'
export { ForbiddenError } from './errors/ForbiddenError'
export { ValidationError } from './errors/ValidationError'
export { TooManyRequestsError } from './errors/TooManyRequestsError'
export { UploadedFile } from './http/UploadedFile'

// Implementations (for direct use or extension)
export { ContainerImpl } from './container/Container'
export { HttpKernel } from './http/Kernel'
export { Pipeline } from './middleware/Pipeline'
export { CoreServiceProvider } from './providers/CoreServiceProvider'

// Global helpers
export { config } from './helpers/config'
export { env } from './helpers/env'
export { app } from './helpers/app'
export { route } from './helpers/route'
export { abort } from './helpers/abort'
```

---

*This spec is the implementation contract for `@mantiq/core`. An AI builder should be able to implement this package from this document alone, referencing the Master Spec only for cross-cutting conventions.*
