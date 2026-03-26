export default {
  title: 'Directory Structure',
  content: `
<h2>Overview</h2>

<p>
  A freshly created MantiqJS application follows a well-defined directory structure inspired
  by Laravel. Every file has a clear purpose and a conventional location. The <code>Discoverer</code>
  auto-discovers providers, routes, models, middleware, commands, and other classes from these
  conventional directories, so following the structure means everything works seamlessly without
  manual registration.
</p>

<div class="dir-tree">
  <div class="dir-root">my-app</div>
  <div class="dir-group">
    <div class="dir-folder" data-open>
      <span class="dir-icon">📁</span> app
      <div class="dir-children">
        <div class="dir-folder"><span class="dir-icon">📁</span> Console/Commands <span class="dir-desc">Custom CLI commands</span></div>
        <div class="dir-folder" data-open>
          <span class="dir-icon">📁</span> Http
          <div class="dir-children">
            <div class="dir-folder"><span class="dir-icon">📁</span> Controllers <span class="dir-desc">Request handlers</span></div>
            <div class="dir-folder"><span class="dir-icon">📁</span> Middleware <span class="dir-desc">Custom middleware</span></div>
          </div>
        </div>
        <div class="dir-folder"><span class="dir-icon">📁</span> Jobs <span class="dir-desc">Queued jobs</span></div>
        <div class="dir-folder"><span class="dir-icon">📁</span> Listeners <span class="dir-desc">Event listeners</span></div>
        <div class="dir-folder"><span class="dir-icon">📁</span> Models <span class="dir-desc">ORM model classes</span></div>
        <div class="dir-folder"><span class="dir-icon">📁</span> Observers <span class="dir-desc">Model observers</span></div>
        <div class="dir-folder"><span class="dir-icon">📁</span> Policies <span class="dir-desc">Authorization policies</span></div>
        <div class="dir-folder"><span class="dir-icon">📁</span> Providers <span class="dir-desc">Service providers</span></div>
      </div>
    </div>
    <div class="dir-folder">
      <span class="dir-icon">📁</span> bootstrap
      <div class="dir-children">
        <div class="dir-file"><span class="dir-icon">📄</span> manifest.json <span class="dir-desc">Auto-discovery cache</span></div>
      </div>
    </div>
    <div class="dir-folder" data-open>
      <span class="dir-icon">📁</span> config <span class="dir-badge">17 files</span>
      <div class="dir-children">
        <div class="dir-file"><span class="dir-icon ts">TS</span> app.ts <span class="dir-desc">Name, env, port, middlewareGroups</span></div>
        <div class="dir-file"><span class="dir-icon ts">TS</span> auth.ts <span class="dir-desc">Guards &amp; user providers</span></div>
        <div class="dir-file"><span class="dir-icon ts">TS</span> broadcasting.ts <span class="dir-desc">Realtime driver config</span></div>
        <div class="dir-file"><span class="dir-icon ts">TS</span> database.ts <span class="dir-desc">SQLite, Postgres, MySQL, MSSQL, Mongo</span></div>
        <div class="dir-file"><span class="dir-icon ts">TS</span> session.ts <span class="dir-desc">Session driver &amp; cookie</span></div>
        <div class="dir-file dim"><span class="dir-icon ts">TS</span> cache, cors, filesystem, hashing, heartbeat, logging, mail, notify, queue, search, services, vite</div>
      </div>
    </div>
    <div class="dir-folder" data-open>
      <span class="dir-icon">📁</span> database
      <div class="dir-children">
        <div class="dir-folder"><span class="dir-icon">📁</span> migrations <span class="dir-desc">Schema migration files</span></div>
        <div class="dir-folder"><span class="dir-icon">📁</span> seeders <span class="dir-desc">Database seeder classes</span></div>
        <div class="dir-folder"><span class="dir-icon">📁</span> factories <span class="dir-desc">Model factory classes</span></div>
      </div>
    </div>
    <div class="dir-folder" data-open>
      <span class="dir-icon">📁</span> routes
      <div class="dir-children">
        <div class="dir-file"><span class="dir-icon ts">TS</span> web.ts <span class="dir-desc">Browser routes — <code>web</code> middleware group</span></div>
        <div class="dir-file"><span class="dir-icon ts">TS</span> api.ts <span class="dir-desc">API routes — auto <code>/api</code> prefix</span></div>
        <div class="dir-file"><span class="dir-icon ts">TS</span> channels.ts <span class="dir-desc">Broadcast channel authorization</span></div>
        <div class="dir-file"><span class="dir-icon ts">TS</span> console.ts <span class="dir-desc">Scheduled tasks</span></div>
      </div>
    </div>
    <div class="dir-folder">
      <span class="dir-icon">📁</span> src <span class="dir-desc">Frontend (starter kit)</span>
      <div class="dir-children">
        <div class="dir-folder"><span class="dir-icon">📁</span> components</div>
        <div class="dir-folder"><span class="dir-icon">📁</span> pages</div>
        <div class="dir-file"><span class="dir-icon tsx">TSX</span> main.tsx</div>
        <div class="dir-file"><span class="dir-icon css">CSS</span> style.css</div>
      </div>
    </div>
    <div class="dir-folder"><span class="dir-icon">📁</span> public <span class="dir-desc">Static assets</span></div>
    <div class="dir-folder"><span class="dir-icon">📁</span> storage <span class="dir-desc">Logs, cache, uploads</span></div>
  </div>
  <div class="dir-group dir-root-files">
    <div class="dir-file"><span class="dir-icon env">ENV</span> .env <span class="dir-desc">Environment variables</span></div>
    <div class="dir-file highlight"><span class="dir-icon ts">TS</span> index.ts <span class="dir-desc">Application bootstrap</span></div>
    <div class="dir-file highlight"><span class="dir-icon ts">TS</span> mantiq.ts <span class="dir-desc">CLI entry point</span></div>
    <div class="dir-file"><span class="dir-icon ts">TS</span> vite.config.ts <span class="dir-desc">Vite bundler config</span></div>
    <div class="dir-file"><span class="dir-icon">📄</span> tsconfig.json</div>
    <div class="dir-file"><span class="dir-icon">📄</span> package.json</div>
  </div>
</div>

<h2>The Root Directory</h2>

<h3>index.ts</h3>
<p>
  The application bootstrap file. This is the entry point for your HTTP server. It creates the
  <code>Application</code> instance, uses the <code>Discoverer</code> to auto-discover providers and routes,
  bootstraps the application, and starts the server:
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

<p>
  The <code>import.meta.main</code> guard ensures the server only starts when the file is
  executed directly, so the CLI can import the application bootstrap without starting the
  HTTP server.
</p>

<h3>mantiq.ts</h3>
<p>
  The CLI entry point. When you run <code>bun mantiq &lt;command&gt;</code>, Bun executes this
  file. It imports the application bootstrap (which registers all providers and routes), then
  hands control to the auto-discovering CLI kernel:
</p>

<pre><code class="language-typescript">#!/usr/bin/env bun
await import('./index.ts')

import { Kernel } from '@mantiq/cli'

const kernel = new Kernel()
const code = await kernel.run()
process.exit(code)</code></pre>

<p>
  The <code>Kernel</code> constructor takes no arguments &mdash; it auto-discovers built-in commands
  and any custom commands in <code>app/Console/Commands/</code>.
</p>

<h3>.env</h3>
<p>
  Environment variables for your application. MantiqJS reads these at startup and makes them
  available via the <code>env()</code> helper. This file should never be committed to version
  control. A <code>.env.example</code> file with placeholder values should be committed instead.
</p>

<h3>vite.config.ts</h3>
<p>
  Present when using a starter kit. Configures Vite for your frontend framework, including
  the entry points, output directory, and any framework-specific plugins.
</p>

<h2>The app Directory</h2>

<p>
  The <code>app/</code> directory contains the core application code &mdash; your controllers,
  middleware, models, service providers, commands, jobs, and listeners. The Discoverer scans
  these directories automatically.
</p>

<h3>app/Http/Controllers/</h3>
<p>
  Controllers handle incoming HTTP requests and return responses. Each controller is a class
  with methods referenced by the tuple syntax in route files:
</p>

<pre><code class="language-typescript">import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'

export class UserController {
  async index(request: MantiqRequest): Promise&lt;Response&gt; {
    const users = await User.all()
    return MantiqResponse.json({ data: users })
  }

  async show(request: MantiqRequest): Promise&lt;Response&gt; {
    const user = await User.findOrFail(request.param('id'))
    return MantiqResponse.json({ data: user })
  }
}</code></pre>

<h3>app/Http/Middleware/</h3>
<p>
  Custom middleware classes that intercept requests before they reach your controllers.
  The Discoverer auto-discovers middleware from this directory.
</p>

<h3>app/Models/</h3>
<p>
  ORM model classes. Each model maps to a database table. The Discoverer auto-discovers models
  for features like auto-binding route model parameters.
</p>

<pre><code class="language-typescript">import { Model } from '@mantiq/database'

export class Post extends Model {
  static override fillable = ['title', 'body', 'user_id']
}</code></pre>

<h3>app/Providers/</h3>
<p>
  Application-level service providers. The Discoverer auto-discovers files matching
  <code>*ServiceProvider.ts</code> in this directory and registers them alongside the
  framework providers. You can create additional providers to register application-specific
  services in the container.
</p>

<h3>app/Console/Commands/</h3>
<p>
  Custom CLI commands. The Discoverer auto-discovers files matching <code>*Command.ts</code>
  and makes them available through <code>bun mantiq</code>.
</p>

<h2>The config Directory</h2>

<p>
  Each file in <code>config/</code> exports a configuration object. The file name becomes the
  top-level key, so <code>config/app.ts</code> is accessed as <code>config('app.name')</code>
  and <code>config/database.ts</code> as <code>config('database.default')</code>.
</p>

<p>
  The skeleton generates 17 config files covering all framework subsystems:
  <code>app</code>, <code>auth</code>, <code>broadcasting</code>, <code>cache</code>,
  <code>cors</code>, <code>database</code>, <code>filesystem</code>, <code>hashing</code>,
  <code>heartbeat</code>, <code>logging</code>, <code>mail</code>, <code>notify</code>,
  <code>queue</code>, <code>search</code>, <code>services</code>, <code>session</code>,
  and <code>vite</code>.
</p>

<h3>config/app.ts</h3>
<p>
  Application-level settings: name, environment, debug mode, encryption key, URL, port,
  base path, and <code>middlewareGroups</code> that define which middleware runs for web
  and API routes.
</p>

<h3>config/database.ts</h3>
<p>
  Database connection configuration: default connection name and connection definitions for
  SQLite, PostgreSQL, MySQL, MSSQL, and MongoDB, with support for read/write splitting and
  connection pooling.
</p>

<h2>The database Directory</h2>

<h3>database/migrations/</h3>
<p>
  Migration files that define your database schema. Each migration has an <code>up()</code>
  method to apply changes and a <code>down()</code> method to reverse them. Migrations run
  in filename order:
</p>

<pre><code class="language-typescript">import { Migration, SchemaBuilder } from '@mantiq/database'

export default class CreateUsersTable extends Migration {
  override async up(schema: SchemaBuilder): Promise&lt;void&gt; {
    await schema.create('users', (table) =&gt; {
      table.id()
      table.string('name')
      table.string('email').unique()
      table.string('password')
      table.timestamps()
    })
  }

  override async down(schema: SchemaBuilder): Promise&lt;void&gt; {
    await schema.dropIfExists('users')
  }
}</code></pre>

<h3>database/seeders/</h3>
<p>
  Seeder classes that populate your database with test or default data. The main seeder
  can call other seeders to organize seeding logic.
</p>

<h3>database/factories/</h3>
<p>
  Model factories for generating fake data. Used in tests and seeders to create model
  instances with realistic attributes:
</p>

<pre><code class="language-typescript">import { Factory, Faker } from '@mantiq/database'
import { User } from '../../app/Models/User.ts'

export class UserFactory extends Factory&lt;User&gt; {
  protected override model = User

  override definition(index: number, fake: Faker) {
    return {
      name: fake.name(),
      email: fake.email(),
      password: 'hashed_password',
    }
  }
}</code></pre>

<h2>The routes Directory</h2>

<h3>routes/web.ts</h3>
<p>
  Web routes for your application. The Discoverer automatically applies the <code>web</code>
  middleware group (sessions, CSRF, cookies) to all routes in this file:
</p>

<pre><code class="language-typescript">import type { Router } from '@mantiq/core'
import { HomeController } from '../app/Http/Controllers/HomeController.ts'

export default function (router: Router) {
  router.get('/', [HomeController, 'index'])
  router.get('/about', [HomeController, 'about'])
}</code></pre>

<h3>routes/api.ts</h3>
<p>
  API routes. The Discoverer automatically applies the <code>api</code> middleware group and
  adds the <code>/api</code> prefix to all routes in this file. You do not need to add the
  prefix manually:
</p>

<pre><code class="language-typescript">import type { Router } from '@mantiq/core'
import { UserController } from '../app/Http/Controllers/UserController.ts'

export default function (router: Router) {
  // These routes are accessible at /api/users, /api/users/:id, etc.
  router.get('/users', [UserController, 'index'])
  router.post('/users', [UserController, 'store'])
  router.get('/users/:id', [UserController, 'show'])
  router.put('/users/:id', [UserController, 'update'])
  router.delete('/users/:id', [UserController, 'destroy'])
}</code></pre>

<h3>routes/channels.ts</h3>
<p>
  Broadcast channel authorization callbacks. Define which users can subscribe to private
  and presence channels for realtime features.
</p>

<h3>routes/console.ts</h3>
<p>
  Scheduled tasks and console-only commands. Define recurring tasks using the
  <code>schedule</code> helper.
</p>

<h2>The src Directory</h2>

<p>
  Present only when using a starter kit. Contains your frontend application code:
</p>

<ul>
  <li><code>src/main.tsx</code> (or <code>.vue</code>, <code>.svelte</code>) &mdash; The frontend entry point</li>
  <li><code>src/pages/</code> &mdash; Page components rendered by the server</li>
  <li><code>src/components/</code> &mdash; Reusable UI components</li>
  <li><code>src/style.css</code> &mdash; Global styles (Tailwind CSS by default)</li>
</ul>

<h2>The public Directory</h2>

<p>
  Files in <code>public/</code> are served as-is by the <code>ServeStaticFiles</code> middleware.
  Place your favicon, robots.txt, and any other static assets here. These files are served
  at the root URL &mdash; <code>public/favicon.ico</code> is accessible at <code>/favicon.ico</code>.
</p>

<h2>The storage Directory</h2>

<p>
  Application storage for runtime data:
</p>

<ul>
  <li><code>storage/logs/</code> &mdash; Application log files</li>
  <li><code>storage/cache/</code> &mdash; File-based cache data</li>
  <li><code>storage/sessions/</code> &mdash; File-based session data</li>
  <li><code>storage/app/</code> &mdash; Application-generated files</li>
</ul>

<p>Add <code>storage/</code> to your <code>.gitignore</code> to keep runtime data out of version control.</p>
`
}
