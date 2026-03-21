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

<pre><code class="language-typescript">// Before middleware — runs BEFORE the route handler
export class BeforeMiddleware implements Middleware {
  async handle(request: MantiqRequest, next: NextFunction): Promise&lt;Response&gt; {
    // Your logic here (e.g., check authentication)
    return next()
  }
}

// After middleware — runs AFTER the route handler
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

<h2>Registering Middleware</h2>

<h3>Middleware Aliases</h3>
<p>
  Before middleware can be referenced by name in routes, it must be registered as an alias with the
  HTTP kernel. This is typically done in your application's bootstrap file or a service provider.
</p>

<pre><code class="language-typescript">import { AuthenticateMiddleware } from './app/Http/Middleware/Authenticate.ts'
import { AdminMiddleware } from './app/Http/Middleware/Admin.ts'
import { ThrottleMiddleware } from './app/Http/Middleware/Throttle.ts'

kernel.registerMiddleware('auth', AuthenticateMiddleware)
kernel.registerMiddleware('admin', AdminMiddleware)
kernel.registerMiddleware('throttle', ThrottleMiddleware)</code></pre>

<h3>Global Middleware</h3>
<p>
  Global middleware runs on every HTTP request, before route-specific middleware is resolved.
  Set the global middleware stack via <code>kernel.setGlobalMiddleware()</code>.
</p>

<pre><code class="language-typescript">kernel.setGlobalMiddleware([
  'cors',
  'encrypt-cookies',
  'start-session',
  'csrf',
  'trim-strings',
])</code></pre>

<p>
  Global middleware aliases must also be registered with <code>registerMiddleware()</code>.
  The order in the array determines execution order &mdash; the first middleware in the list
  runs first on the way in and last on the way out.
</p>

<h3>Middleware Groups</h3>
<p>
  Middleware groups allow you to bundle several middleware aliases under a single name.
  The kernel provides built-in <code>web</code> and <code>api</code> groups that you can customise.
</p>

<pre><code class="language-typescript">kernel.registerMiddlewareGroup('web', [
  'encrypt-cookies',
  'start-session',
  'csrf',
])

kernel.registerMiddlewareGroup('api', [
  'throttle:60,1',
])</code></pre>

<h3>Route Middleware</h3>
<p>
  Assign middleware to individual routes using the <code>.middleware()</code> method on a route definition.
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

<p>Then register and use it:</p>

<pre><code class="language-typescript">// Register the alias
kernel.registerMiddleware('auth', AuthenticateMiddleware)

// Use on routes
router.get('/profile', [ProfileController, 'show']).middleware('auth')</code></pre>

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

<p>
  The order of global middleware matters. Cookie encryption should run before session handling,
  and session handling before CSRF verification. A typical order is:
  CorsMiddleware, EncryptCookies, StartSession, VerifyCsrfToken, TrimStrings.
</p>
`
}
