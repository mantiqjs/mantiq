export default {
  title: 'Introduction',
  content: `
<h2>What is MantiqJS?</h2>

<p>
  MantiqJS is a batteries-included TypeScript web framework built on the
  <a href="https://bun.sh">Bun</a> runtime (version 1.1.0 or later). Inspired by the elegance and developer experience of
  <a href="https://laravel.com">Laravel</a>, MantiqJS brings convention-over-configuration to the TypeScript ecosystem &mdash;
  giving you a structured, full-stack framework with routing, an ORM, authentication,
  validation, CLI tooling, and frontend integration out of the box.
</p>

<p>
  If you have ever wished for a Laravel-like experience in TypeScript &mdash; with real
  dependency injection, an expressive query builder, Artisan-style commands, and first-class
  Vite integration &mdash; MantiqJS is built for you.
</p>

<h2>Why MantiqJS?</h2>

<p>
  The JavaScript ecosystem has no shortage of web frameworks, but most fall into one of two camps:
  minimal micro-frameworks that leave you wiring everything together yourself, or opinionated
  full-stack tools that lock you into a specific frontend. MantiqJS takes a different path:
</p>

<ul>
  <li>
    <strong>Full-stack by default.</strong> Routing, middleware, controllers, ORM, migrations,
    authentication, validation, sessions, caching, encryption, hashing, and CLI commands are
    all included. You do not need to hunt for third-party packages to build a real application.
  </li>
  <li>
    <strong>TypeScript-strict from the ground up.</strong> MantiqJS is written in strict TypeScript
    with <code>noImplicitOverride</code>, <code>strictNullChecks</code>, and full type safety.
    Your editor will guide you through the API.
  </li>
  <li>
    <strong>Built on Bun.</strong> Bun&rsquo;s native HTTP server, SQLite driver, file I/O, and
    fast startup make MantiqJS exceptionally performant. No Node.js polyfills or compatibility
    layers needed.
  </li>
  <li>
    <strong>Convention over configuration.</strong> Sensible defaults for directory structure,
    naming conventions, and configuration mean you spend less time wiring and more time building.
    The <code>Discoverer</code> auto-discovers providers, routes, models, middleware, and commands
    from conventional directories.
  </li>
  <li>
    <strong>Frontend-agnostic with first-class kits.</strong> Use React, Vue, or Svelte via
    starter kits with Vite integration and server-side rendering support. Or skip the frontend
    entirely and build a pure API.
  </li>
</ul>

<h2>Key Features</h2>

<h3>IoC Service Container</h3>
<p>
  A powerful inversion-of-control container with singleton and transient bindings, auto-resolution,
  contextual binding, circular dependency detection, and deferred service providers. Services are
  bound using class constructor keys for full type safety.
</p>

<h3>Routing &amp; Middleware</h3>
<p>
  An expressive router supporting all HTTP methods, route parameters with constraints, named routes,
  route groups with prefix and middleware inheritance, resource routes, and URL generation.
  Middleware uses a pipeline pattern with support for middleware groups (web and api) that are
  automatically applied by the Discoverer based on the route filename.
</p>

<h3>Database &amp; ORM</h3>
<p>
  A fluent query builder with support for 5 database drivers: SQLite, PostgreSQL, MySQL, MSSQL,
  and MongoDB. The Eloquent-inspired ORM provides models with relationships (hasOne, hasMany,
  belongsTo, belongsToMany), soft deletes, attribute casting, timestamps, fillable/guarded
  attributes, and eager loading. Schema migrations and database seeding with factories are included.
</p>

<h3>Authentication</h3>
<p>
  A guard-based authentication system with session and token guards, a database user provider,
  built-in middleware for protecting routes, OAuth integration, social authentication, and a
  simple <code>auth()</code> helper for checking authentication state anywhere in your application.
</p>

<h3>Validation</h3>
<p>
  A validator with 46 built-in rules, custom rule support, form request classes for
  controller-level validation, and a presence verifier for database-dependent rules like
  <code>unique</code> and <code>exists</code>.
</p>

<h3>CLI Commands</h3>
<p>
  An Artisan-inspired CLI with 37 built-in commands for generating models, controllers, migrations,
  middleware, seeders, factories, form requests, events, listeners, jobs, and more. Database
  commands handle migration, rollback, reset, fresh, status, and seeding. The CLI kernel uses
  auto-discovery so custom commands are picked up automatically.
</p>

<h3>Vite Integration</h3>
<p>
  First-class Vite support with asset resolution, hot module replacement in development,
  manifest-based asset loading in production, and server-side rendering for React, Vue,
  and Svelte starter kits.
</p>

<h2>The Package Ecosystem</h2>

<p>
  MantiqJS is organised as a modular monorepo of 21 packages. Each subsystem is a standalone
  npm package under the <code>@mantiq</code> scope:
</p>

<table>
  <thead>
    <tr>
      <th>Package</th>
      <th>Purpose</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><code>@mantiq/core</code></td><td>Application, container, config, routing, HTTP kernel, middleware, sessions, cache, encryption, hashing</td></tr>
    <tr><td><code>@mantiq/database</code></td><td>Query builder, ORM models, schema builder, migrations, seeders, factories (SQLite, PostgreSQL, MySQL, MSSQL, MongoDB)</td></tr>
    <tr><td><code>@mantiq/auth</code></td><td>Authentication guards, user providers, auth middleware, AuthenticatableModel mixin</td></tr>
    <tr><td><code>@mantiq/validation</code></td><td>Validator, form requests, 46 built-in rules</td></tr>
    <tr><td><code>@mantiq/cli</code></td><td>Auto-discovering CLI kernel, command parsing, 37 built-in commands</td></tr>
    <tr><td><code>@mantiq/vite</code></td><td>Vite dev server integration, asset resolution, SSR rendering</td></tr>
    <tr><td><code>@mantiq/helpers</code></td><td>Str, Arr, Num, Collection classes, HTTP client, async utilities</td></tr>
    <tr><td><code>@mantiq/events</code></td><td>Event dispatcher, listeners, broadcastable events</td></tr>
    <tr><td><code>@mantiq/filesystem</code></td><td>File storage abstraction with local and cloud drivers</td></tr>
    <tr><td><code>@mantiq/mail</code></td><td>Email sending with SMTP, SES, and other transports</td></tr>
    <tr><td><code>@mantiq/notify</code></td><td>Multi-channel notifications (mail, database, broadcast)</td></tr>
    <tr><td><code>@mantiq/queue</code></td><td>Job queueing with sync, database, and Redis drivers</td></tr>
    <tr><td><code>@mantiq/realtime</code></td><td>WebSocket server, channel authorization, presence tracking, SSE fallback</td></tr>
    <tr><td><code>@mantiq/logging</code></td><td>Structured logging with multiple channels and drivers</td></tr>
    <tr><td><code>@mantiq/oauth</code></td><td>OAuth2 server and client implementation</td></tr>
    <tr><td><code>@mantiq/social-auth</code></td><td>Social authentication (Google, GitHub, etc.)</td></tr>
    <tr><td><code>@mantiq/search</code></td><td>Full-text search with Meilisearch, Elasticsearch, and Typesense drivers</td></tr>
    <tr><td><code>@mantiq/health</code></td><td>Application health checks and monitoring endpoints</td></tr>
    <tr><td><code>@mantiq/heartbeat</code></td><td>Development debug toolbar and request inspector</td></tr>
    <tr><td><code>@mantiq/testing</code></td><td>Testing utilities, HTTP testing helpers, fakes</td></tr>
    <tr><td><code>@mantiq/create-mantiq</code></td><td>Project scaffolder (<code>bun create mantiq</code>)</td></tr>
  </tbody>
</table>

<h2>A Quick Taste</h2>

<p>
  Here is what a typical MantiqJS application looks like. The bootstrap file uses the
  <code>Discoverer</code> to auto-discover providers, routes, and middleware:
</p>

<pre><code class="language-typescript">import { Application, CoreServiceProvider, HttpKernel, RouterImpl, Discoverer } from '@mantiq/core'

const app = await Application.create(import.meta.dir, 'config')

const discoverer = new Discoverer(import.meta.dir)
const isDev = process.env['APP_ENV'] !== 'production'
const manifest = await discoverer.resolve(isDev)
const userProviders = await discoverer.loadProviders(manifest)

await app.bootstrap([CoreServiceProvider], userProviders)

const router = app.make(RouterImpl)
await discoverer.loadRoutes(manifest, router)

export default app

if (import.meta.main) {
  const kernel = app.make(HttpKernel)
  await kernel.start()
}</code></pre>

<p>The <code>import.meta.main</code> guard ensures the server only starts when the file is executed directly, so the CLI can import the application bootstrap without starting the HTTP server.</p>

<p>Routes are defined in separate files that the Discoverer loads automatically. The route filename determines which middleware group is applied &mdash; <code>routes/web.ts</code> gets the <code>web</code> group, and <code>routes/api.ts</code> gets the <code>api</code> group with an automatic <code>/api</code> prefix:</p>

<pre><code class="language-typescript">// routes/web.ts
import type { Router } from '@mantiq/core'
import { HomeController } from '../app/Http/Controllers/HomeController.ts'

export default function (router: Router) {
  router.get('/', [HomeController, 'index'])
}

// routes/api.ts &mdash; routes automatically get /api prefix
import type { Router } from '@mantiq/core'

export default function (router: Router) {
  router.get('/ping', () =&gt; {
    return MantiqResponse.json({ status: 'ok' })
  })
  // Accessible at /api/ping
}</code></pre>

<h2>Requirements</h2>

<ul>
  <li><strong>Bun 1.1.0+</strong> &mdash; MantiqJS uses Bun-specific APIs (<code>Bun.serve</code>, <code>Bun.file</code>, <code>bun:sqlite</code>) and is not compatible with Node.js.</li>
  <li><strong>TypeScript 5.0+</strong> &mdash; Strict mode is enabled by default in generated projects.</li>
</ul>

<h2>Getting Help</h2>

<p>
  If you are new to MantiqJS, start with the <a href="/docs/installation">Installation</a> guide
  to create your first project, then follow the <a href="/docs/directory-structure">Directory Structure</a>
  page to understand how a MantiqJS application is organised. The
  <a href="/docs/request-lifecycle">Request Lifecycle</a> page will give you a mental model
  of how requests flow through the framework.
</p>
`
}
