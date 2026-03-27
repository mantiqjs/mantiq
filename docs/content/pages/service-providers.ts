export default {
  title: 'Service Providers',
  content: `
<h2>Overview</h2>

<p>
  Service providers are the central place for bootstrapping your MantiqJS application. Every
  major framework feature &mdash; routing, database, authentication, sessions, caching &mdash;
  is set up by a service provider. Your own application services should be registered through
  providers as well.
</p>

<p>
  A service provider has two jobs:
</p>

<ol>
  <li><strong>Register</strong> bindings in the service container</li>
  <li><strong>Boot</strong> those services after all providers are registered</li>
</ol>

<p>
  This two-phase lifecycle ensures that when your <code>boot()</code> method runs, every
  service in the application has already been registered and is available for resolution.
</p>

<h2>Auto-Discovery</h2>

<p>
  The <code>Discoverer</code> automatically discovers service providers from the
  <code>app/Providers/</code> directory. Any file matching the pattern <code>*ServiceProvider.ts</code>
  is loaded and registered alongside the framework providers. You do not need to manually
  list your providers in the bootstrap file.
</p>

<p>
  The bootstrap file (<code>index.ts</code>) uses the Discoverer to load providers:
</p>

<pre><code class="language-typescript">import { Application, CoreServiceProvider, Discoverer } from '@mantiq/core'

const app = await Application.create(import.meta.dir, 'config')

const discoverer = new Discoverer(import.meta.dir)
const isDev = process.env['APP_ENV'] !== 'production'
const manifest = await discoverer.resolve(isDev)
const userProviders = await discoverer.loadProviders(manifest)

// Framework providers are listed explicitly; user providers are auto-discovered
await app.bootstrap([CoreServiceProvider], userProviders)</code></pre>

<p>
  Framework providers like <code>CoreServiceProvider</code> are passed as the first argument
  to <code>app.bootstrap()</code>. User providers discovered from <code>app/Providers/</code>
  are passed as the second argument and are registered after the framework providers.
</p>

<h2>Writing a Service Provider</h2>

<p>
  A service provider extends the <code>ServiceProvider</code> base class from
  <code>@mantiq/core</code>:
</p>

<pre><code class="language-typescript">import { ServiceProvider } from '@mantiq/core'
import { ConfigRepository } from '@mantiq/core'

export class MailServiceProvider extends ServiceProvider {
  override register(): void {
    this.app.singleton(MailTransport, (container) =&gt; {
      const config = container.make(ConfigRepository)
      const driver = config.get('mail.default', 'smtp')

      if (driver === 'smtp') {
        return new SmtpTransport(config.get('mail.drivers.smtp'))
      }
      return new LogTransport()
    })

    this.app.singleton(Mailer, (container) =&gt; {
      const transport = container.make(MailTransport)
      const config = container.make(ConfigRepository)
      return new Mailer(transport, config.get('mail.from'))
    })
  }

  override boot(): void {
    // Safe to resolve dependencies here
    const mailer = this.app.make(Mailer)
    mailer.registerTemplateEngine(new HandlebarsEngine())
  }
}</code></pre>

<p>
  Place this file in <code>app/Providers/MailServiceProvider.ts</code> and the Discoverer
  will automatically pick it up.
</p>

<h2>The register() Method</h2>

<p>
  The <code>register()</code> method should <strong>only</strong> bind things into the service
  container. You should never attempt to resolve other services, register event listeners, or
  perform any other action that depends on another provider having been registered. The reason:
  when <code>register()</code> is called, other providers may not have registered their bindings
  yet.
</p>

<pre><code class="language-typescript">override register(): void {
  // GOOD: Only bind into the container
  this.app.singleton(PaymentGateway, (c) =&gt; {
    return new StripeGateway(c.make(ConfigRepository).get('services.stripe.key'))
  })
}

// BAD: Don't resolve other services in register()
override register(): void {
  // This might fail if DatabaseServiceProvider hasn't registered yet
  const db = this.app.make(DatabaseManager)  // Risky!
}</code></pre>

<p>
  The one exception is <code>ConfigRepository</code> &mdash; it is safe to resolve in
  <code>register()</code> because config is loaded by <code>Application.create()</code> before
  any provider runs.
</p>

<h2>The boot() Method</h2>

<p>
  The <code>boot()</code> method is called after <strong>all</strong> providers have been
  registered. This is the place to perform initialization that depends on other services:
</p>

<pre><code class="language-typescript">override async boot(): Promise&lt;void&gt; {
  // Safe to resolve any registered service
  const router = this.app.make(RouterImpl)
  const auth = this.app.make(AuthManager)

  // Register routes, event listeners, view composers, etc.
  router.get('/webhook/stripe', [WebhookController, 'handleStripe'])
}</code></pre>

<p>
  Both <code>register()</code> and <code>boot()</code> can be synchronous or asynchronous
  (returning a <code>Promise</code>). The application awaits each method before proceeding.
</p>

<h2>Deferred Providers</h2>

<p>
  Some providers register bindings that are not needed on every request. For example, a
  queueing provider might only be needed when a job is dispatched. Deferred providers are
  not registered until one of their bindings is first resolved from the container.
</p>

<p>
  To make a provider deferred, set <code>deferred = true</code> and implement
  <code>provides()</code> to list the bindings it offers:
</p>

<pre><code class="language-typescript">import { ServiceProvider } from '@mantiq/core'
import type { Bindable } from '@mantiq/core'

export class QueueServiceProvider extends ServiceProvider {
  override deferred = true

  override provides(): Bindable&lt;any&gt;[] {
    return [QueueManager, QueueWorker]
  }

  override register(): void {
    this.app.singleton(QueueManager, (c) =&gt; {
      return new QueueManager(c.make(ConfigRepository).get('queue'))
    })

    this.app.singleton(QueueWorker, (c) =&gt; {
      return new QueueWorker(c.make(QueueManager))
    })
  }

  override boot(): void {
    // Runs only when the provider is actually loaded
  }
}</code></pre>

<p>
  When the application encounters a request for <code>QueueManager</code> and finds no binding
  in the container, it checks the deferred provider index. If a deferred provider claims that
  binding, the provider is registered and booted on the spot, then the binding is resolved
  normally.
</p>

<p>
  Deferred providers reduce startup time by only loading services that are actually used during
  a given request.
</p>

<p>
  Deferred providers must have synchronous <code>register()</code> and <code>boot()</code> methods.
  Because deferred loading happens during a synchronous <code>make()</code> call, async initialization
  is not supported.
</p>

<h2>Framework Providers</h2>

<p>
  MantiqJS ships with several built-in service providers. Understanding what they register
  helps you know what is available in the container.
</p>

<h3>CoreServiceProvider</h3>

<p>
  The foundation provider, registered first. Binds:
</p>

<ul>
  <li><code>RouterImpl</code> &mdash; the application router (singleton)</li>
  <li><code>HttpKernel</code> &mdash; the HTTP request handler (singleton)</li>
  <li><code>WebSocketKernel</code> &mdash; WebSocket upgrade handler (singleton)</li>
  <li><code>DefaultExceptionHandler</code> &mdash; error rendering (singleton)</li>
  <li><code>HashManager</code> &mdash; bcrypt/argon2 hashing (singleton)</li>
  <li><code>CacheManager</code> &mdash; memory/file/null cache stores (singleton)</li>
  <li><code>SessionManager</code> &mdash; memory/file/cookie session handlers (singleton)</li>
  <li>Built-in middleware: <code>CorsMiddleware</code>, <code>TrimStringsMiddleware</code>, <code>StartSession</code>, <code>EncryptCookies</code>, <code>VerifyCsrfToken</code></li>
</ul>

<p>
  In its <code>boot()</code> method, CoreServiceProvider initializes the <code>AesEncrypter</code>
  from the <code>APP_KEY</code> if one is configured. This is async because the key import
  uses the Web Crypto API.
</p>

<h3>DatabaseServiceProvider</h3>

<p>
  Registers the <code>DatabaseManager</code> as a singleton. Reads connection configuration
  from <code>config('database')</code> and manages connections to SQLite, PostgreSQL, MySQL,
  MSSQL, and MongoDB.
</p>

<h3>AuthServiceProvider</h3>

<p>
  Registers the <code>AuthManager</code> with session-based and request-based guards, and
  a database user provider. Reads guard and provider configuration from <code>config('auth')</code>.
</p>

<h3>ViteServiceProvider</h3>

<p>
  Integrates Vite with MantiqJS. Registers the Vite manifest reader for production asset
  resolution, the <code>ServeStaticFiles</code> middleware, and the SSR rendering engine.
  Reads configuration from <code>config('vite')</code>.
</p>

<h3>FilesystemServiceProvider</h3>

<p>
  Registers the filesystem manager with configured disk drivers (local, S3, etc.). Reads
  configuration from <code>config('filesystem')</code>.
</p>

<h2>Creating an Application Provider</h2>

<p>
  Generate a new provider with the CLI:
</p>

<pre><code class="language-bash">bun mantiq make:provider AppServiceProvider</code></pre>

<p>
  Here is a complete example of an application service provider that registers custom services:
</p>

<pre><code class="language-typescript">// app/Providers/AppServiceProvider.ts
import { ServiceProvider, ConfigRepository } from '@mantiq/core'

export class AppServiceProvider extends ServiceProvider {
  override register(): void {
    // Register application services
    this.app.singleton(NotificationService, (c) =&gt; {
      const config = c.make(ConfigRepository)
      return new NotificationService(
        config.get('notifications.default'),
        config.get('notifications.channels'),
      )
    })

    this.app.bind(OrderService, (c) =&gt; {
      return new OrderService(
        c.make(PaymentGateway),
        c.make(NotificationService),
      )
    })
  }

  override boot(): void {
    // Perform initialization that depends on other services
    const notifier = this.app.make(NotificationService)
    notifier.registerChannel('sms', new SmsChannel())
  }
}</code></pre>

<p>
  Place this in <code>app/Providers/AppServiceProvider.ts</code> and the Discoverer will
  automatically register it.
</p>

<h2>The Provider Lifecycle Timeline</h2>

<p>
  Here is the complete sequence of events during application bootstrap:
</p>

<pre><code class="language-bash">1. Application.create()
   - Config loaded from config/ directory
   - ConfigRepository bound as instance

2. Discoverer.resolve()
   - Scans app/Providers/ for *ServiceProvider.ts files
   - Scans routes/, app/Console/Commands/, app/Models/, etc.
   - Builds or loads cached manifest

3. app.bootstrap(frameworkProviders, userProviders)
   For each provider (framework first, then user):
   - If deferred: index its provides() bindings, skip registration
   - If not deferred: call register()
   Then for each registered (non-deferred) provider:
   - Call boot()

4. discoverer.loadRoutes()
   - Imports route files and applies middleware groups by filename

5. Application is ready
   - HTTP kernel can start handling requests
   - Deferred providers load on first use</code></pre>

<h2>Best Practices</h2>

<ul>
  <li>
    <strong>Keep register() pure.</strong> Only bind services. Do not resolve dependencies,
    register routes, or perform I/O.
  </li>
  <li>
    <strong>Use boot() for initialization.</strong> Anything that depends on other services
    should happen in <code>boot()</code>.
  </li>
  <li>
    <strong>Defer when possible.</strong> If a service is only used in specific scenarios
    (CLI commands, scheduled tasks, webhooks), make its provider deferred to improve startup
    performance.
  </li>
  <li>
    <strong>One provider per concern.</strong> Instead of a giant AppServiceProvider, consider
    splitting into focused providers: <code>PaymentServiceProvider</code>,
    <code>NotificationServiceProvider</code>, etc. The Discoverer will pick them all up.
  </li>
  <li>
    <strong>Use singletons for stateful services.</strong> Database managers, cache stores,
    session handlers, and configuration objects should be singletons. Transient bindings are
    appropriate for request-scoped or stateless services.
  </li>
</ul>
`
}
