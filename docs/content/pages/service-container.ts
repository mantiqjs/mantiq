export default {
  title: 'Service Container',
  content: `
<h2>Overview</h2>

<p>
  The MantiqJS service container is an inversion-of-control (IoC) container that manages class
  dependencies and performs dependency injection. It is the foundation of the framework &mdash;
  almost every component is resolved through it, from the router to controllers to middleware.
</p>

<p>
  The <code>Application</code> class extends the container directly, so the application instance
  <strong>is</strong> the container. You interact with it through the <code>app()</code> helper,
  through the <code>this.app</code> property in service providers, or by type-hinting the
  <code>Application</code> class.
</p>

<h2>Binding Basics</h2>

<p>
  Binding tells the container how to build instances of a given type. There are three ways
  to register bindings:
</p>

<h3>Transient Bindings with bind()</h3>

<p>
  A transient binding creates a <strong>new instance</strong> every time it is resolved:
</p>

<pre><code class="language-typescript">import { app } from '@mantiq/core'

// Bind using a factory function
app().bind(UserRepository, (container) =&gt; {
  const db = container.make(DatabaseManager)
  return new UserRepository(db)
})

// Each call to make() creates a new instance
const repo1 = app(UserRepository)
const repo2 = app(UserRepository)
// repo1 !== repo2</code></pre>

<h3>Singleton Bindings with singleton()</h3>

<p>
  A singleton binding creates the instance <strong>once</strong> and caches it. Every subsequent
  resolution returns the same instance:
</p>

<pre><code class="language-typescript">app().singleton(RouterImpl, (container) =&gt; {
  const config = container.make(ConfigRepository)
  return new RouterImpl(config)
})

// Same instance every time
const router1 = app(RouterImpl)
const router2 = app(RouterImpl)
// router1 === router2</code></pre>

<h3>Instance Bindings with instance()</h3>

<p>
  If you already have a constructed object, register it directly as a singleton:
</p>

<pre><code class="language-typescript">const config = new ConfigRepository(data)
app().instance(ConfigRepository, config)

// Returns the exact object you registered
app(ConfigRepository) === config  // true</code></pre>

<h2>Resolution</h2>

<h3>Resolving with make()</h3>

<p>
  Use <code>make()</code> to resolve an instance from the container:
</p>

<pre><code class="language-typescript">import { Application, ConfigRepository, HttpKernel } from '@mantiq/core'

// Resolve from the container
const config = app(ConfigRepository)
const kernel = app(HttpKernel)

// Or use make() directly on the Application instance
const app = Application.getInstance()
const router = app.make(RouterImpl)</code></pre>

<h3>Safe Resolution with makeOrDefault()</h3>

<p>
  If you are unsure whether a binding exists, use <code>makeOrDefault()</code> to avoid
  exceptions:
</p>

<pre><code class="language-typescript">const logger = app().makeOrDefault(Logger, new ConsoleLogger())
// Returns Logger if bound, otherwise ConsoleLogger</code></pre>

<h3>Checking Bindings with has()</h3>

<pre><code class="language-typescript">if (app().has(CacheManager)) {
  const cache = app(CacheManager)
  // ...
}</code></pre>

<h2>Class-Based Keys</h2>

<p>
  Unlike many IoC containers that use string keys, MantiqJS uses <strong>class constructors</strong>
  as binding keys. This provides full type safety &mdash; when you call
  <code>app.make(ConfigRepository)</code>, TypeScript knows the return type is
  <code>ConfigRepository</code>.
</p>

<pre><code class="language-typescript">// CORRECT: Class-based key (type-safe)
const config = app().make(ConfigRepository)
// TypeScript infers: ConfigRepository

// WRONG: String key (will throw 'not_bound')
const config = app().make('config')
// Error: No binding found for 'config'</code></pre>

<p>
  Always use the class constructor as the key, not a string. String keys only work if you
  have registered an explicit alias for them.
</p>

<h3>Bindable Types</h3>

<p>
  The container accepts three types of keys (the <code>Bindable</code> type):
</p>

<ul>
  <li><strong>Class constructors</strong> &mdash; <code>ConfigRepository</code>, <code>RouterImpl</code>, <code>MyService</code> (most common)</li>
  <li><strong>Symbols</strong> &mdash; <code>Symbol('HttpKernel')</code> (used for non-class abstract types)</li>
  <li><strong>Strings</strong> &mdash; <code>'cache.store'</code> (only via explicit aliases)</li>
</ul>

<h3>Resolvable Types</h3>

<p>
  When registering a binding, the concrete implementation can be:
</p>

<ul>
  <li><strong>A factory function</strong> &mdash; <code>(container) =&gt; new MyService(container.make(Dep))</code></li>
  <li><strong>A class constructor</strong> &mdash; <code>MyServiceImpl</code> (auto-resolved if it has zero constructor parameters)</li>
</ul>

<h2>Auto-Resolution</h2>

<p>
  If a class has no explicit binding but is requested from the container, MantiqJS attempts
  <strong>auto-resolution</strong>. If the class constructor takes zero arguments, it is
  instantiated directly:
</p>

<pre><code class="language-typescript">class UserController {
  // Zero constructor parameters — auto-resolvable
  index(request: MantiqRequest) {
    return Response.json({ message: 'Hello' })
  }
}

// No binding needed — the container can instantiate this directly
const controller = app().make(UserController)</code></pre>

<p>
  If the constructor requires parameters that cannot be resolved, the container throws a
  <code>ContainerResolutionError</code> with reason <code>'unresolvable_parameter'</code>.
  In that case, register an explicit binding with a factory function.
</p>

<h2>Aliases</h2>

<p>
  Aliases allow you to resolve a binding using an alternative key &mdash; typically a
  <code>Symbol</code> or a string:
</p>

<pre><code class="language-typescript">// Register the binding under its class key
app().singleton(RouterImpl, (c) =&gt; new RouterImpl(c.make(ConfigRepository)))

// Create an alias
const ROUTER = Symbol('Router')
app().alias(RouterImpl, ROUTER)

// Both resolve to the same instance
app().make(RouterImpl) === app().make(ROUTER)  // true</code></pre>

<p>
  The framework uses aliases internally to provide ergonomic helper functions. For example,
  the <code>route()</code> helper resolves the router via its symbol alias, and the
  <code>ENCRYPTER</code> symbol provides access to the encryption service.
</p>

<h2>Contextual Binding</h2>

<p>
  Sometimes different classes need different implementations of the same interface. Contextual
  binding lets you specify what implementation a particular consumer should receive:
</p>

<pre><code class="language-typescript">import { app } from '@mantiq/core'

// When UserController needs a Logger, give it UserLogger
app().when(UserController).needs(Logger).give(UserLogger)

// When OrderController needs a Logger, give it OrderLogger
app().when(OrderController).needs(Logger).give(OrderLogger)

// Each controller gets its own logger implementation
const userCtrl = app(UserController)   // gets UserLogger
const orderCtrl = app(OrderController) // gets OrderLogger</code></pre>

<p>
  The <code>give()</code> method accepts either a class constructor (for auto-resolution) or
  a factory function:
</p>

<pre><code class="language-typescript">app().when(PaymentController)
  .needs(PaymentGateway)
  .give((container) =&gt; {
    const config = container.make(ConfigRepository)
    return new StripeGateway(config.get('services.stripe.key'))
  })</code></pre>

<h2>Circular Dependency Detection</h2>

<p>
  The container tracks which bindings are currently being resolved. If a circular dependency
  is detected (A depends on B, which depends on A), the container throws a
  <code>ContainerResolutionError</code> with reason <code>'circular_dependency'</code> instead
  of entering an infinite loop:
</p>

<pre><code class="language-typescript">// This would be caught immediately:
// ServiceA -&gt; needs ServiceB -&gt; needs ServiceA
// ContainerResolutionError: Circular dependency detected while resolving ServiceA</code></pre>

<p>
  If you encounter a circular dependency, refactor one of the services to use setter injection
  or a factory pattern. Deferred service providers can also help break initialization cycles.
</p>

<h2>Method Injection</h2>

<p>
  The container provides a <code>call()</code> method for invoking methods on objects with
  dependency injection:
</p>

<pre><code class="language-typescript">const result = app().call&lt;string&gt;(myService, 'processOrder', {
  orderId: '12345',
})</code></pre>

<h2>Flushing the Container</h2>

<p>
  In testing scenarios, you may want to clear all bindings and start fresh:
</p>

<pre><code class="language-typescript">app().flush()
// All bindings, instances, aliases, and contextual bindings are removed</code></pre>

<p>
  Flushing the container removes all framework bindings, so only use it in tests where you
  need a clean slate. Be sure to re-register the providers your test depends on.
</p>

<h2>The app() Helper</h2>

<p>
  The <code>app()</code> helper is the most convenient way to access the container from
  anywhere in your application:
</p>

<pre><code class="language-typescript">import { app } from '@mantiq/core'

// Get the Application instance (which is the container)
const application = app()

// Resolve a binding (shorthand for app().make())
const router = app(RouterImpl)
const config = app(ConfigRepository)</code></pre>

<h2>Core Framework Bindings</h2>

<p>
  The following services are bound by the framework&rsquo;s built-in service providers:
</p>

<table>
  <thead>
    <tr>
      <th>Key</th>
      <th>Type</th>
      <th>Provider</th>
      <th>Scope</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><code>Application</code></td><td>Application</td><td>Auto</td><td>Singleton</td></tr>
    <tr><td><code>ConfigRepository</code></td><td>ConfigRepository</td><td>Auto</td><td>Instance</td></tr>
    <tr><td><code>RouterImpl</code></td><td>RouterImpl</td><td>CoreServiceProvider</td><td>Singleton</td></tr>
    <tr><td><code>HttpKernel</code></td><td>HttpKernel</td><td>CoreServiceProvider</td><td>Singleton</td></tr>
    <tr><td><code>HashManager</code></td><td>HashManager</td><td>CoreServiceProvider</td><td>Singleton</td></tr>
    <tr><td><code>CacheManager</code></td><td>CacheManager</td><td>CoreServiceProvider</td><td>Singleton</td></tr>
    <tr><td><code>SessionManager</code></td><td>SessionManager</td><td>CoreServiceProvider</td><td>Singleton</td></tr>
    <tr><td><code>ENCRYPTER</code> (Symbol)</td><td>AesEncrypter</td><td>CoreServiceProvider</td><td>Instance</td></tr>
    <tr><td><code>DatabaseManager</code></td><td>DatabaseManager</td><td>DatabaseServiceProvider</td><td>Singleton</td></tr>
    <tr><td><code>AuthManager</code></td><td>AuthManager</td><td>AuthServiceProvider</td><td>Singleton</td></tr>
  </tbody>
</table>

<h2>Complete Example</h2>

<p>
  Here is a complete example showing various container features working together:
</p>

<pre><code class="language-typescript">import { app, Application, ConfigRepository } from '@mantiq/core'

// --- In a service provider's register() method ---

// Singleton: payment gateway configured from app config
this.app.singleton(PaymentGateway, (c) =&gt; {
  const config = c.make(ConfigRepository)
  const key = config.get('services.stripe.key')
  return new StripeGateway(key)
})

// Transient: each request gets a fresh cart
this.app.bind(ShoppingCart, () =&gt; new ShoppingCart())

// Contextual: different repositories for different controllers
this.app.when(AdminController).needs(UserRepository).give(AdminUserRepository)
this.app.when(ApiController).needs(UserRepository).give(ApiUserRepository)

// --- In application code ---

// Resolve services
const gateway = app(PaymentGateway)   // always the same StripeGateway instance
const cart1 = app(ShoppingCart)       // new ShoppingCart
const cart2 = app(ShoppingCart)       // another new ShoppingCart

// Check bindings
app().has(PaymentGateway)  // true
app().has(SomeService)     // false</code></pre>
`
}
