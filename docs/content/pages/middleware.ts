export default {
  title: 'Middleware',
  content: `
<h2>Introduction</h2>
<p>
  Middleware provides a mechanism for filtering and inspecting HTTP requests entering your application.
  Each middleware can examine the request before it reaches your route handler, modify the response on
  the way out, or short-circuit the pipeline entirely. MantiqJS middleware is inspired by the
  pipeline pattern: requests flow through a stack of middleware layers, each calling <code>next()</code>
  to pass control to the next layer.
</p>

<p>Common use cases for middleware include:</p>
<ul>
  <li>Authentication and authorization checks</li>
  <li>CSRF token verification</li>
  <li>CORS header management</li>
  <li>Session handling</li>
  <li>Request logging and rate limiting</li>
  <li>Input sanitization (e.g., trimming strings)</li>
</ul>

<h2>The Middleware Contract</h2>
<p>
  Every middleware class implements the <code>Middleware</code> interface from <code>@mantiq/core</code>.
  The contract defines a required <code>handle()</code> method and two optional methods.
</p>

<pre><code class="language-typescript">import type { Middleware, NextFunction } from '@mantiq/core'
import type { MantiqRequest } from '@mantiq/core'

export class LogRequestMiddleware implements Middleware {
  async handle(request: MantiqRequest, next: NextFunction): Promise&lt;Response&gt; {
    console.log(\`[\${request.method()}] \${request.path()}\`)

    // Pass to the next middleware (or route handler)
    const response = await next()

    console.log(\`Response: \${response.status}\`)
    return response
  }
}</code></pre>

<p>
  The <code>next</code> parameter is a function that, when called, invokes the next middleware in the
  pipeline (or the route handler if this is the last middleware). You <strong>must</strong> return a
  <code>Response</code> from <code>handle()</code> -- either the one from <code>next()</code> or a
  new one you construct yourself.
</p>

<h3>Before and After Middleware</h3>
<p>
  The position of <code>await next()</code> determines when your logic runs relative to the route handler.
</p>

<pre><code class="language-typescript">// Before middleware &mdash; runs BEFORE the route handler
export class BeforeMiddleware implements Middleware {
  async handle(request: MantiqRequest, next: NextFunction): Promise&lt;Response&gt; {
    // Your logic here (e.g., check authentication)
    return next()
  }
}

// After middleware &mdash; runs AFTER the route handler
export class AfterMiddleware implements Middleware {
  async handle(request: MantiqRequest, next: NextFunction): Promise&lt;Response&gt; {
    const response = await next()
    // Your logic here (e.g., add headers to response)
    return response
  }
}</code></pre>

<h3>Short-Circuiting</h3>
<p>
  To stop the request from reaching the route handler, return a response without calling <code>next()</code>.
</p>

<pre><code class="language-typescript">export class MaintenanceModeMiddleware implements Middleware {
  async handle(request: MantiqRequest, next: NextFunction): Promise&lt;Response&gt; {
    if (process.env['MAINTENANCE_MODE'] === 'true') {
      return MantiqResponse.html('&lt;h1&gt;Under Maintenance&lt;/h1&gt;', 503)
    }
    return next()
  }
}</code></pre>

<h2>Middleware Groups</h2>

<p>
  Middleware groups bundle several middleware aliases under a single name. Groups are configured
  in <code>config/app.ts</code> and are automatically applied by the Discoverer based on the route
  filename.
</p>

<pre><code class="language-typescript">// config/app.ts
export default {
  // ...other config

  middlewareGroups: {
    web: ['cors', 'encrypt.cookies', 'session', 'csrf'],
    api: ['cors', 'throttle'],
  },
}</code></pre>

<h3>How Groups Are Applied</h3>
<p>
  The Discoverer automatically maps route files to middleware groups:
</p>
<ul>
  <li><code>routes/web.ts</code> &rarr; all routes receive the <code>web</code> middleware group</li>
  <li><code>routes/api.ts</code> &rarr; all routes receive the <code>api</code> middleware group (and the <code>/api</code> prefix)</li>
</ul>

<p>
  The <code>web</code> group includes stateful middleware for browser-facing routes: CORS headers,
  cookie encryption, session management, and CSRF protection. The <code>api</code> group includes
  stateless middleware for API endpoints: CORS headers and rate limiting.
</p>

<p>
  You do not need to manually register these groups or apply them in your route files. The
  Discoverer handles it automatically based on convention.
</p>

<h2>Route Middleware</h2>
<p>
  In addition to group-level middleware, you can assign middleware to individual routes using the
  <code>.middleware()</code> method on a route definition.
</p>

<pre><code class="language-typescript">router.get('/dashboard', [DashboardController, 'index']).middleware('auth')

router.post('/settings', [SettingsController, 'update'])
  .middleware('auth', 'admin')</code></pre>

<p>
  Middleware can also be applied to all routes in a group:
</p>

<pre><code class="language-typescript">router.group({ prefix: '/admin', middleware: ['auth', 'admin'] }, (router) =&gt; {
  router.get('/dashboard', [AdminController, 'dashboard'])
  router.get('/users', [AdminController, 'users'])
})</code></pre>

<h2>Middleware Parameters</h2>
<p>
  Middleware can receive parameters via the alias string using a colon separator. For example,
  <code>'throttle:60,1'</code> passes <code>['60', '1']</code> to the middleware. Implement
  the optional <code>setParameters()</code> method to receive them.
</p>

<pre><code class="language-typescript">export class ThrottleMiddleware implements Middleware {
  private maxAttempts = 60
  private decayMinutes = 1

  setParameters(params: string[]): void {
    if (params[0]) this.maxAttempts = Number(params[0])
    if (params[1]) this.decayMinutes = Number(params[1])
  }

  async handle(request: MantiqRequest, next: NextFunction): Promise&lt;Response&gt; {
    // Use this.maxAttempts and this.decayMinutes for rate limiting
    return next()
  }
}</code></pre>

<pre><code class="language-typescript">// Usage: passes ['60', '1'] to setParameters()
router.get('/api/data', handler).middleware('throttle:60,1')</code></pre>

<h2>Terminable Middleware</h2>
<p>
  Some middleware needs to perform work <em>after</em> the response has been sent to the client.
  Implement the optional <code>terminate()</code> method for tasks like logging, analytics, or cleanup.
</p>

<pre><code class="language-typescript">export class RequestLogMiddleware implements Middleware {
  async handle(request: MantiqRequest, next: NextFunction): Promise&lt;Response&gt; {
    return next()
  }

  async terminate(request: MantiqRequest, response: Response): Promise&lt;void&gt; {
    // Runs after the response is sent
    await logToDatabase({
      method: request.method(),
      path: request.path(),
      status: response.status,
      timestamp: new Date(),
    })
  }
}</code></pre>

<p>
  The <code>terminate()</code> method runs after the response body has been streamed to the client.
  It receives the original request and the final response, making it ideal for non-blocking
  post-request work.
</p>

<h2>Writing Custom Middleware</h2>
<p>
  Generate a new middleware class with the CLI:
</p>

<pre><code class="language-bash">bun mantiq make:middleware EnsureIsAdmin</code></pre>

<p>
  Here is a complete example of an authentication middleware that checks for a valid session user:
</p>

<pre><code class="language-typescript">import type { Middleware, NextFunction } from '@mantiq/core'
import type { MantiqRequest } from '@mantiq/core'
import { UnauthorizedError } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'

export class AuthenticateMiddleware implements Middleware {
  async handle(request: MantiqRequest, next: NextFunction): Promise&lt;Response&gt; {
    if (!request.isAuthenticated()) {
      if (request.expectsJson()) {
        throw new UnauthorizedError('Authentication required.')
      }
      return MantiqResponse.redirect('/login')
    }

    return next()
  }
}</code></pre>

<p>Then use it on routes:</p>

<pre><code class="language-typescript">router.get('/profile', [ProfileController, 'show']).middleware('auth')</code></pre>

<h2>Built-in Middleware</h2>
<p>MantiqJS ships with several middleware classes out of the box:</p>

<h3>CorsMiddleware</h3>
<p>
  Handles Cross-Origin Resource Sharing headers. Automatically responds to preflight
  <code>OPTIONS</code> requests and adds CORS headers to all responses. Configured via
  <code>config/cors.ts</code> with options for allowed origins, methods, headers, credentials,
  and max age.
</p>

<h3>StartSession</h3>
<p>
  Starts a session for the request. Reads the session ID from the cookie, loads session data
  from the configured handler (memory, file, or cookie), attaches the session to the request,
  ages flash data after the response, and writes the session cookie back.
</p>

<h3>EncryptCookies</h3>
<p>
  Encrypts outgoing cookies and decrypts incoming cookies using AES encryption. Cookies listed
  in the <code>except</code> array are left unencrypted (e.g., XSRF-TOKEN, which must be readable
  by JavaScript for the double-submit pattern).
</p>

<h3>VerifyCsrfToken</h3>
<p>
  Protects against cross-site request forgery. Verifies that <code>POST</code>, <code>PUT</code>,
  <code>PATCH</code>, and <code>DELETE</code> requests include a valid CSRF token. The token
  can be provided via a <code>_token</code> form field, the <code>X-CSRF-TOKEN</code> header,
  or the encrypted <code>X-XSRF-TOKEN</code> header. URIs can be excluded from verification via
  the <code>except</code> array.
</p>

<h3>TrimStrings</h3>
<p>
  Automatically trims whitespace from all string values in the request input. This middleware
  runs globally so your controllers always receive clean input.
</p>

<h2>Available Middleware Aliases</h2>
<p>
  The following aliases are available for use in middleware groups and route definitions:
</p>
<ul>
  <li><code>cors</code> &mdash; CorsMiddleware</li>
  <li><code>encrypt.cookies</code> &mdash; EncryptCookies</li>
  <li><code>session</code> &mdash; StartSession</li>
  <li><code>csrf</code> &mdash; VerifyCsrfToken</li>
  <li><code>throttle</code> &mdash; ThrottleMiddleware (parameterised)</li>
  <li><code>auth</code> &mdash; Authenticate</li>
  <li><code>guest</code> &mdash; RedirectIfAuthenticated</li>
  <li><code>trim</code> &mdash; TrimStrings</li>
  <li><code>static</code> &mdash; ServeStaticFiles</li>
  <li><code>heartbeat</code> &mdash; Heartbeat debug toolbar</li>
</ul>

<p>
  The order of middleware within a group matters. Cookie encryption should run before session handling,
  and session handling before CSRF verification. The default <code>web</code> group order is:
  CorsMiddleware, EncryptCookies, StartSession, VerifyCsrfToken.
</p>
`
}
