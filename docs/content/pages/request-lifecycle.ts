export default {
  title: 'Request Lifecycle',
  content: `
<h2>Overview</h2>

<p>
  Understanding how a request flows through MantiqJS gives you a mental model for where your
  code fits in. Every HTTP request follows the same path from the moment Bun receives it to the
  moment a response is sent back to the client. This page traces that journey step by step.
</p>

<h2>The Lifecycle at a Glance</h2>

<pre><code class="language-bash">Client Request
    |
    v
Bun.serve() fetch handler
    |
    v
HttpKernel.handle()
    |
    v
Global Middleware Pipeline
    |
    v
Router.resolve()        -- match route by method + path
    |
    v
Route Middleware Pipeline
    |
    v
Controller Action       -- your code runs here
    |
    v
Response Preparation
    |
    v
Client Response</code></pre>

<h2>Step 1: Bun.serve()</h2>

<p>
  MantiqJS uses Bun&rsquo;s built-in HTTP server. When the application starts, the
  <code>HttpKernel</code> calls <code>Bun.serve()</code> and registers its <code>handle()</code>
  method as the fetch callback:
</p>

<pre><code class="language-typescript">Bun.serve({
  port: config('app.port', 3000),
  hostname: config('app.host', '0.0.0.0'),
  fetch: (req, server) =&gt; kernel.handle(req, server),
  websocket: wsKernel.getBunHandlers(),
})</code></pre>

<p>
  Every incoming HTTP request is handed to <code>HttpKernel.handle()</code> as a native
  <code>Request</code> object.
</p>

<h3>WebSocket Upgrades</h3>

<p>
  If the request contains an <code>Upgrade: websocket</code> header, the kernel immediately
  delegates to the <code>WebSocketKernel</code> for WebSocket upgrade handling. The rest
  of the HTTP pipeline is skipped.
</p>

<h2>Step 2: HttpKernel.handle()</h2>

<p>
  The HTTP kernel is the central coordinator for request handling. It performs three key tasks:
</p>

<ol>
  <li>Wraps the native <code>Request</code> into a <code>MantiqRequest</code></li>
  <li>Runs the request through the global middleware pipeline</li>
  <li>Catches any unhandled exceptions and passes them to the exception handler</li>
</ol>

<pre><code class="language-typescript">async handle(bunRequest: Request, server: Server): Promise&lt;Response&gt; {
  const request = MantiqRequest.fromBun(bunRequest)

  try {
    const response = await new Pipeline(this.container)
      .send(request)
      .through(globalMiddleware)
      .then(async (req) =&gt; {
        const match = this.router.resolve(req)
        // ... route middleware + controller ...
      })
    return this.prepareResponse(response)
  } catch (err) {
    return this.exceptionHandler.render(request, err)
  }
}</code></pre>

<h3>MantiqRequest</h3>

<p>
  The <code>MantiqRequest</code> wraps Bun&rsquo;s native <code>Request</code> and provides
  a rich API for accessing request data: path, method, headers, query parameters, body parsing,
  route parameters, cookies, session data, uploaded files, and more.
</p>

<h2>Step 3: Global Middleware Pipeline</h2>

<p>
  Before the router is consulted, the request passes through the global middleware stack.
  Global middleware runs on <strong>every</strong> request, in the order you define:
</p>

<pre><code class="language-typescript">kernel.setGlobalMiddleware([
  'static',              // Serve static files from public/
  'cors',                // Set CORS headers
  'encrypt.cookies',     // Encrypt/decrypt cookies
  'session',             // Start the session
])</code></pre>

<p>
  MantiqJS uses a <strong>Pipeline</strong> to execute middleware. Each middleware receives the
  request and a <code>next</code> function. It can:
</p>

<ul>
  <li><strong>Pass the request forward</strong> by calling <code>return next()</code></li>
  <li><strong>Short-circuit</strong> by returning a <code>Response</code> without calling <code>next()</code></li>
  <li><strong>Modify the request</strong> before calling <code>next()</code></li>
  <li><strong>Modify the response</strong> after calling <code>next()</code></li>
</ul>

<pre><code class="language-typescript">class CorsMiddleware implements Middleware {
  async handle(request: MantiqRequest, next: NextFunction): Promise&lt;Response&gt; {
    // Before: could inspect or modify the request
    const response = await next()
    // After: add CORS headers to the response
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response
  }
}</code></pre>

<h2>Step 4: Route Resolution</h2>

<p>
  After global middleware completes, the <code>Router</code> resolves the request to a matching
  route. The router inspects the HTTP method and URL path, comparing them against all registered
  routes:
</p>

<pre><code class="language-typescript">const match = this.router.resolve(request)
// match = {
//   action: [UserController, 'show'],
//   params: { id: '42' },
//   middleware: ['auth'],
//   routeName: 'users.show',
// }</code></pre>

<p>
  The route matcher supports:
</p>

<ul>
  <li><strong>Static segments:</strong> <code>/users</code></li>
  <li><strong>Dynamic parameters:</strong> <code>/users/:id</code></li>
  <li><strong>Optional parameters:</strong> <code>/users/:id?</code></li>
  <li><strong>Regex constraints:</strong> <code>/users/:id</code> with <code>.where('id', '\\d+')</code></li>
  <li><strong>Wildcard routes:</strong> <code>/files/*path</code></li>
</ul>

<h3>When No Route Matches</h3>

<p>
  If no route matches the request path and method:
</p>

<ul>
  <li>If the path exists under a <strong>different HTTP method</strong>, a <code>405 Method Not Allowed</code> response is returned with an <code>Allow</code> header listing the valid methods.</li>
  <li>If the path does not match <strong>any</strong> route, a <code>404 Not Found</code> error is thrown and handled by the exception handler.</li>
</ul>

<h2>Step 5: Route Middleware Pipeline</h2>

<p>
  After the route is resolved, any middleware attached to the route or its group is executed
  in a second pipeline. This is where authentication, authorization, rate limiting, and other
  route-specific middleware run:
</p>

<pre><code class="language-typescript">// Routes can have middleware attached
router.get('/dashboard', [DashboardController, 'index']).middleware('auth')

// Groups apply middleware to all contained routes
router.group({ prefix: '/admin', middleware: ['auth', 'admin'] }, (r) =&gt; {
  r.get('/users', [AdminController, 'users'])
  r.get('/settings', [AdminController, 'settings'])
})</code></pre>

<p>
  Middleware aliases are resolved through the kernel&rsquo;s middleware registry, which maps
  short names to class constructors:
</p>

<pre><code class="language-typescript">kernel.registerMiddleware('auth', Authenticate)
kernel.registerMiddleware('admin', RequireAdmin)</code></pre>

<h3>Middleware Groups</h3>

<p>
  You can define middleware groups that expand to multiple middleware:
</p>

<pre><code class="language-typescript">kernel.registerMiddlewareGroup('web', [
  'encrypt.cookies',
  'session',
  'csrf',
])

// Then use the group name on routes
router.group({ middleware: ['web'] }, (r) =&gt; {
  // These routes get encrypt.cookies, session, and csrf middleware
})</code></pre>

<h3>Parameterised Middleware</h3>

<p>
  Middleware can receive parameters via the colon syntax:
</p>

<pre><code class="language-typescript">router.get('/api/posts', handler).middleware('throttle:60,1')
// The ThrottleMiddleware receives ['60', '1'] via setParameters()</code></pre>

<h2>Step 6: Controller Action</h2>

<p>
  Once all middleware has passed, the route action is invoked. Route actions can be either
  controller class method pairs or inline closures:
</p>

<pre><code class="language-typescript">// Controller action: resolved from the container, then method is called
router.get('/users/:id', [UserController, 'show'])

// Closure action: called directly with the request
router.get('/health', (request) =&gt; Response.json({ status: 'ok' }))</code></pre>

<p>
  When a controller action is used, the kernel resolves the controller from the service
  container using <code>container.make(ControllerClass)</code>. This means controllers can
  have dependencies injected through the container.
</p>

<p>
  The controller method receives the <code>MantiqRequest</code> and can return various types:
</p>

<ul>
  <li>A <code>Response</code> object &mdash; returned as-is</li>
  <li>A string &mdash; wrapped in an HTML response</li>
  <li>An object or array &mdash; serialized as JSON</li>
  <li><code>null</code> or <code>undefined</code> &mdash; a 204 No Content response</li>
</ul>

<h2>Step 7: Response Preparation</h2>

<p>
  The return value from the controller action is converted to a native <code>Response</code>
  object by <code>HttpKernel.prepareResponse()</code>. This ensures a consistent response
  format regardless of what the controller returns:
</p>

<pre><code class="language-typescript">// String -&gt; HTML response
return 'Hello, World!'

// Object -&gt; JSON response
return { users: [...] }

// Response -&gt; passed through unchanged
return Response.json(data, { status: 201 })

// null/undefined -&gt; 204 No Content
return null</code></pre>

<h2>Step 8: Exception Handling</h2>

<p>
  If any exception is thrown during the lifecycle &mdash; in middleware, route resolution, or
  the controller action &mdash; it is caught by the <code>try/catch</code> in
  <code>HttpKernel.handle()</code> and passed to the <code>ExceptionHandler</code>:
</p>

<pre><code class="language-typescript">catch (err) {
  return this.exceptionHandler.render(request, err)
}</code></pre>

<p>
  The default exception handler converts known error types to appropriate HTTP responses:
</p>

<ul>
  <li><code>NotFoundError</code> &rarr; 404</li>
  <li><code>UnauthorizedError</code> &rarr; 401</li>
  <li><code>ForbiddenError</code> &rarr; 403</li>
  <li><code>ValidationError</code> &rarr; 422</li>
  <li><code>TooManyRequestsError</code> &rarr; 429</li>
  <li><code>HttpError</code> &rarr; the error&rsquo;s status code</li>
  <li>Unknown errors &rarr; 500 (with a detailed dev error page when <code>APP_DEBUG=true</code>)</li>
</ul>

<h2>Terminable Middleware</h2>

<p>
  Some middleware needs to perform work <strong>after</strong> the response has been sent to the
  client. Middleware classes can implement an optional <code>terminate()</code> method for this:
</p>

<pre><code class="language-typescript">class LogRequestsMiddleware implements Middleware {
  async handle(request: MantiqRequest, next: NextFunction): Promise&lt;Response&gt; {
    return next()
  }

  async terminate(request: MantiqRequest, response: Response): Promise&lt;void&gt; {
    // Runs after the response is sent
    await logToDatabase(request.method(), request.path(), response.status)
  }
}</code></pre>

<h2>Summary</h2>

<p>
  The complete lifecycle in order:
</p>

<ol>
  <li><code>Bun.serve()</code> receives the HTTP request</li>
  <li><code>HttpKernel.handle()</code> wraps it in a <code>MantiqRequest</code></li>
  <li>The request passes through the <strong>global middleware pipeline</strong></li>
  <li><code>Router.resolve()</code> finds the matching route</li>
  <li>Route parameters are extracted and set on the request</li>
  <li>The request passes through the <strong>route middleware pipeline</strong></li>
  <li>The <strong>controller action</strong> (or closure) is invoked</li>
  <li>The return value is converted to a <code>Response</code></li>
  <li>Any thrown exception is caught and rendered by the <strong>ExceptionHandler</strong></li>
  <li>Terminable middleware runs after the response is sent</li>
</ol>
`
}
