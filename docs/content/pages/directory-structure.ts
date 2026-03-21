export default {
  title: 'Directory Structure',
  content: `
<h2>Overview</h2>

<p>
  A freshly created MantiqJS application follows a well-defined directory structure inspired
  by Laravel. Every file has a clear purpose and a conventional location. While MantiqJS does
  not enforce these locations rigidly &mdash; you can organise your code however you like &mdash;
  following the conventions means the CLI generators, auto-discovery, and documentation all
  work seamlessly.
</p>

<pre><code class="language-bash">my-app/
  app/
    Http/
      Controllers/
      Middleware/
    Models/
    Providers/
  config/
    app.ts
    auth.ts
    database.ts
    vite.ts
  database/
    migrations/
    seeders/
    factories/
  routes/
    web.ts
    api.ts
  src/                  # Frontend (if using a starter kit)
    components/
    pages/
    main.tsx
    style.css
  public/               # Static assets served directly
  storage/              # Application storage (logs, cache, sessions)
  .env                  # Environment variables
  index.ts              # Application bootstrap
  mantiq.ts             # CLI entry point
  vite.config.ts        # Vite configuration (if using a starter kit)
  tsconfig.json         # TypeScript configuration
  package.json</code></pre>

<h2>The Root Directory</h2>

<h3>index.ts</h3>
<p>
  The application bootstrap file. This is the entry point for your HTTP server. It creates the
  <code>Application</code> instance, registers service providers, configures the HTTP kernel
  and middleware, loads routes, and starts the server. The file uses an
  <code>import.meta.main</code> guard so the CLI can import it without starting the HTTP server:
</p>

<pre><code class="language-typescript">const app = await Application.create(import.meta.dir, 'config')
await app.registerProviders([CoreServiceProvider, DatabaseServiceProvider])
await app.bootProviders()

const kernel = app.make(HttpKernel)
const router = app.make(RouterImpl)

// ... configure middleware and routes ...

export default app

if (import.meta.main) {
  await kernel.start()
}</code></pre>

<h3>mantiq.ts</h3>
<p>
  The CLI entry point. When you run <code>bun mantiq &lt;command&gt;</code>, Bun executes this
  file. It imports the application bootstrap (which registers all providers and routes), then
  hands control to the CLI kernel:
</p>

<pre><code class="language-typescript">import app from './index.ts'
import { Kernel } from '@mantiq/cli'

const cli = new Kernel(app)
await cli.handle(process.argv.slice(2))</code></pre>

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
  middleware, models, and service providers. This is where most of your day-to-day development
  happens.
</p>

<h3>app/Http/Controllers/</h3>
<p>
  Controllers handle incoming HTTP requests and return responses. Each controller is a class
  with methods that correspond to route actions:
</p>

<pre><code class="language-typescript">import type { MantiqRequest } from '@mantiq/core'

export class UserController {
  async index(request: MantiqRequest): Promise&lt;Response&gt; {
    const users = await User.all()
    return Response.json(users.map(u =&gt; u.toObject()))
  }

  async show(request: MantiqRequest): Promise&lt;Response&gt; {
    const user = await User.findOrFail(request.param('id'))
    return Response.json(user.toObject())
  }
}</code></pre>

<h3>app/Http/Middleware/</h3>
<p>
  Custom middleware classes that intercept requests before they reach your controllers.
  Middleware can inspect, modify, or reject requests, and can also perform post-response
  processing:
</p>

<pre><code class="language-typescript">import type { Middleware, NextFunction } from '@mantiq/core'
import type { MantiqRequest } from '@mantiq/core'

export class LogRequestsMiddleware implements Middleware {
  async handle(request: MantiqRequest, next: NextFunction): Promise&lt;Response&gt; {
    console.log(\`\${request.method()} \${request.path()}\`)
    return next()
  }
}</code></pre>

<h3>app/Models/</h3>
<p>
  ORM model classes. Each model maps to a database table and provides methods for querying,
  creating, updating, and deleting records:
</p>

<pre><code class="language-typescript">import { Model } from '@mantiq/database'

export class User extends Model {
  static override table = 'users'
  static override fillable = ['name', 'email', 'password']
  static override hidden = ['password']
  static override casts = {
    created_at: 'datetime',
    is_admin: 'boolean',
  }
}</code></pre>

<h3>app/Providers/</h3>
<p>
  Application-level service providers. The most common is a custom <code>DatabaseServiceProvider</code>
  that registers your database connection configuration. You can create additional providers
  to register application-specific services in the container.
</p>

<h2>The config Directory</h2>

<p>
  Each file in <code>config/</code> exports a configuration object. The file name becomes the
  top-level key, so <code>config/app.ts</code> is accessed as <code>config('app.name')</code>
  and <code>config/database.ts</code> as <code>config('database.default')</code>.
</p>

<h3>config/app.ts</h3>
<p>
  Application-level settings: name, environment, debug mode, encryption key, URL, and port.
</p>

<h3>config/auth.ts</h3>
<p>
  Authentication configuration: default guard, guard definitions, and user provider settings.
</p>

<h3>config/database.ts</h3>
<p>
  Database connection configuration: default connection name and connection definitions for
  SQLite, PostgreSQL, MySQL, MSSQL, or MongoDB.
</p>

<h3>config/vite.ts</h3>
<p>
  Vite integration settings: entry points, build output directory, manifest path, and dev
  server URL.
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
  Web routes for your application. These routes typically use session-based middleware
  (cookies, CSRF protection, sessions) and return HTML responses or Vite-rendered pages:
</p>

<pre><code class="language-typescript">import type { Router } from '@mantiq/core'
import { HomeController } from '../app/Http/Controllers/HomeController.ts'

export default function (router: Router) {
  router.get('/', [HomeController, 'index'])
  router.get('/about', [HomeController, 'about'])
}</code></pre>

<h3>routes/api.ts</h3>
<p>
  API routes, typically grouped under a <code>/api</code> prefix. These routes are usually
  stateless and return JSON responses:
</p>

<pre><code class="language-typescript">import type { Router } from '@mantiq/core'
import { UserController } from '../app/Http/Controllers/UserController.ts'

export default function (router: Router) {
  router.group({ prefix: '/api' }, (r) =&gt; {
    r.get('/users', [UserController, 'index'])
    r.post('/users', [UserController, 'store'])
    r.get('/users/:id', [UserController, 'show'])
    r.put('/users/:id', [UserController, 'update'])
    r.delete('/users/:id', [UserController, 'destroy'])
  })
}</code></pre>

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
