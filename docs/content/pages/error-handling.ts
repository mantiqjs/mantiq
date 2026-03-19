export default {
  title: 'Error Handling',
  content: `
<h2>Introduction</h2>
<p>
  MantiqJS provides a centralized error handling system through the <code>DefaultExceptionHandler</code>.
  When an exception is thrown anywhere in your application -- in a controller, middleware, or service --
  the exception handler catches it and converts it to an appropriate HTTP response. In development,
  you get a detailed error page; in production, users see a clean error page without sensitive details.
</p>

<h2>The Exception Handler</h2>
<p>
  The <code>DefaultExceptionHandler</code> implements the <code>ExceptionHandler</code> contract and
  provides two key methods: <code>report()</code> for logging errors and <code>render()</code> for
  converting errors to HTTP responses.
</p>

<pre><code class="language-typescript">import { DefaultExceptionHandler } from '@mantiq/core'

// The handler is automatically registered in the container.
// You can extend it to customize behavior:
export class AppExceptionHandler extends DefaultExceptionHandler {
  // Customize as needed
}</code></pre>

<h3>The render() Method</h3>
<p>
  The <code>render()</code> method receives the request and the thrown error, and returns a
  <code>Response</code>. Its behavior depends on the error type, the request's content type
  expectations, and whether debug mode is enabled.
</p>

<pre><code class="language-typescript">render(request: MantiqRequest, error: unknown): Response</code></pre>

<p>The rendering logic follows this decision tree:</p>
<ol>
  <li>If the error is an <code>HttpError</code> with a <code>redirectTo</code> property (and the request is not JSON), redirect to that URL.</li>
  <li>If <code>APP_DEBUG=true</code>, render a detailed developer error page with the stack trace, request details, and error context.</li>
  <li>If the request expects JSON (<code>request.expectsJson()</code>), return a structured JSON error response.</li>
  <li>Otherwise, return a minimal HTML error page showing the status code and message.</li>
</ol>

<h3>The report() Method</h3>
<p>
  The <code>report()</code> method logs errors to stderr by default. It is called automatically
  for every error that is not in the <code>dontReport</code> list.
</p>

<pre><code class="language-typescript">async report(error: Error): Promise&lt;void&gt; {
  // Default: writes to stderr
  // Override to send to your error tracking service:
  console.error(\`[\${new Date().toISOString()}] \${error.name}: \${error.message}\`)
  if (error.stack) console.error(error.stack)
}</code></pre>

<h3>The dontReport Array</h3>
<p>
  Certain error types are expected during normal operation and don't need to be logged.
  The <code>dontReport</code> array specifies which error classes to skip reporting.
</p>

<pre><code class="language-typescript">dontReport: Constructor&lt;Error&gt;[] = [
  NotFoundError,      // 404 — expected for missing pages
  ValidationError,    // 422 — expected for invalid input
  UnauthorizedError,  // 401 — expected for unauthenticated requests
]</code></pre>

<p>
  To add more error types to the skip list, extend the handler and override <code>dontReport</code>:
</p>

<pre><code class="language-typescript">export class AppExceptionHandler extends DefaultExceptionHandler {
  override dontReport = [
    ...super.dontReport,
    TooManyRequestsError,
    TokenMismatchError,
  ]
}</code></pre>

<h2>HTTP Error Types</h2>
<p>
  MantiqJS provides a hierarchy of typed error classes. All HTTP errors extend <code>HttpError</code>,
  which itself extends <code>MantiqError</code> (the base class for all framework errors). Each
  error type sets the appropriate HTTP status code automatically.
</p>

<h3>HttpError (Base)</h3>
<p>
  The base class for all HTTP-specific errors. It carries a status code, message, and optional
  response headers.
</p>

<pre><code class="language-typescript">import { HttpError } from '@mantiq/core'

// Throw a custom HTTP error with any status code
throw new HttpError(409, 'Resource conflict', { 'X-Conflict-Id': '42' })</code></pre>

<h3>NotFoundError (404)</h3>
<pre><code class="language-typescript">import { NotFoundError } from '@mantiq/core'

throw new NotFoundError()                    // "Not Found"
throw new NotFoundError('User not found')    // Custom message</code></pre>

<h3>UnauthorizedError (401)</h3>
<pre><code class="language-typescript">import { UnauthorizedError } from '@mantiq/core'

throw new UnauthorizedError()                         // "Unauthorized"
throw new UnauthorizedError('Invalid credentials')    // Custom message</code></pre>

<h3>ForbiddenError (403)</h3>
<pre><code class="language-typescript">import { ForbiddenError } from '@mantiq/core'

throw new ForbiddenError()                            // "Forbidden"
throw new ForbiddenError('You cannot edit this post') // Custom message</code></pre>

<h3>ValidationError (422)</h3>
<p>
  Carries a structured <code>errors</code> object mapping field names to arrays of error messages.
  When rendered as JSON, the errors object is included in the response body.
</p>

<pre><code class="language-typescript">import { ValidationError } from '@mantiq/core'

throw new ValidationError({
  email: ['The email field is required.', 'The email must be valid.'],
  password: ['The password must be at least 8 characters.'],
})

// Renders as JSON:
// {
//   "error": {
//     "message": "The given data was invalid.",
//     "status": 422,
//     "errors": {
//       "email": ["The email field is required.", "The email must be valid."],
//       "password": ["The password must be at least 8 characters."]
//     }
//   }
// }</code></pre>

<h3>TooManyRequestsError (429)</h3>
<p>
  Used for rate limiting. Optionally includes a <code>Retry-After</code> header indicating how
  many seconds the client should wait.
</p>

<pre><code class="language-typescript">import { TooManyRequestsError } from '@mantiq/core'

throw new TooManyRequestsError()                  // "Too Many Requests"
throw new TooManyRequestsError('Slow down', 60)   // With Retry-After: 60 header</code></pre>

<h2>The abort() Helper</h2>
<p>
  The <code>abort()</code> helper throws an appropriate HTTP error from anywhere in your code --
  controllers, middleware, services, or even model methods. It automatically selects the right
  error subclass based on the status code.
</p>

<pre><code class="language-typescript">import { abort } from '@mantiq/core'

// Throws NotFoundError
abort(404)

// Throws ForbiddenError with a custom message
abort(403, 'You cannot edit this post')

// Throws TooManyRequestsError with Retry-After header
abort(429, 'Slow down', { 'Retry-After': '60' })

// Throws HttpError for any status code
abort(503, 'Service temporarily unavailable')</code></pre>

<p>Status code to error class mapping:</p>
<table>
  <thead>
    <tr><th>Status</th><th>Error Class</th></tr>
  </thead>
  <tbody>
    <tr><td>401</td><td><code>UnauthorizedError</code></td></tr>
    <tr><td>403</td><td><code>ForbiddenError</code></td></tr>
    <tr><td>404</td><td><code>NotFoundError</code></td></tr>
    <tr><td>429</td><td><code>TooManyRequestsError</code></td></tr>
    <tr><td>Any other</td><td><code>HttpError</code></td></tr>
  </tbody>
</table>

<h3>Using abort() in Controllers</h3>
<pre><code class="language-typescript">async show(request: MantiqRequest): Promise&lt;Response&gt; {
  const post = await Post.find(request.param('id'))
  if (!post) abort(404, 'Post not found')

  const user = request.user()
  if (post.userId !== user.id) abort(403, 'You do not own this post')

  return MantiqResponse.json({ data: post })
}</code></pre>

<div class="note">
  <code>abort()</code> has a return type of <code>never</code>, so TypeScript knows that code
  after an <code>abort()</code> call is unreachable. You do not need an <code>else</code> branch
  or a <code>return</code> after calling it.
</div>

<h2>Debug Mode</h2>
<p>
  When <code>APP_DEBUG=true</code> is set in your <code>.env</code> file, MantiqJS renders a
  detailed developer error page for all unhandled exceptions. This page includes:
</p>

<ul>
  <li>The error class name, message, and status code</li>
  <li>The full stack trace with source file paths and line numbers</li>
  <li>Request details (method, URL, headers, input data)</li>
  <li>Any additional context attached to the error</li>
</ul>

<div class="warning">
  Never enable <code>APP_DEBUG=true</code> in production. The debug page exposes sensitive
  information including file paths, environment details, and request data. Always set
  <code>APP_DEBUG=false</code> in your production <code>.env</code> file.
</div>

<p>In production (with debug mode off), errors render as clean, minimal pages:</p>
<ul>
  <li>For JSON requests: <code>{ "error": { "message": "...", "status": 500 } }</code></li>
  <li>For HTML requests: A simple page showing just the status code and message</li>
</ul>

<h2>Custom Exception Handling</h2>
<p>
  Extend <code>DefaultExceptionHandler</code> to customize how your application handles errors.
</p>

<h3>Custom Reporting</h3>
<pre><code class="language-typescript">export class AppExceptionHandler extends DefaultExceptionHandler {
  override async report(error: Error): Promise&lt;void&gt; {
    // Send to your error tracking service
    await errorTracker.captureException(error)

    // Still log to stderr
    await super.report(error)
  }
}</code></pre>

<h3>Custom Rendering</h3>
<pre><code class="language-typescript">export class AppExceptionHandler extends DefaultExceptionHandler {
  override render(request: MantiqRequest, error: unknown): Response {
    // Custom handling for a specific error type
    if (error instanceof PaymentFailedError) {
      if (request.expectsJson()) {
        return MantiqResponse.json({
          error: { message: 'Payment failed', code: error.code },
        }, 402)
      }
      return MantiqResponse.redirect('/billing/retry')
    }

    // Fall back to default handling for everything else
    return super.render(request, error)
  }
}</code></pre>

<h3>Custom Error Types</h3>
<p>
  Create your own error types by extending <code>HttpError</code> or <code>MantiqError</code>.
</p>

<pre><code class="language-typescript">import { HttpError } from '@mantiq/core'

export class PaymentRequiredError extends HttpError {
  constructor(
    public readonly paymentUrl: string,
    message = 'Payment required',
  ) {
    super(402, message)
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Resource conflict') {
    super(409, message)
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(
    message = 'Service temporarily unavailable',
    public readonly retryAfter?: number,
  ) {
    super(503, message, retryAfter ? { 'Retry-After': String(retryAfter) } : undefined)
  }
}</code></pre>

<h2>Error Responses by Content Type</h2>
<p>
  The exception handler automatically adapts its response format based on the client's expectations.
</p>

<h3>JSON Requests</h3>
<p>
  When the client sends an <code>Accept: application/json</code> header (detected by
  <code>request.expectsJson()</code>), errors are rendered as JSON:
</p>

<pre><code class="language-typescript">// Standard HTTP error
{
  "error": {
    "message": "Not Found",
    "status": 404
  }
}

// Validation error (includes field-level errors)
{
  "error": {
    "message": "The given data was invalid.",
    "status": 422,
    "errors": {
      "email": ["The email field is required."],
      "name": ["The name must be at least 2 characters."]
    }
  }
}

// Server error (production — no sensitive details)
{
  "error": {
    "message": "Internal Server Error",
    "status": 500
  }
}</code></pre>

<h3>HTML Requests</h3>
<p>
  For standard browser requests, the handler renders an HTML page. In debug mode this is the
  full developer error page; in production it's a minimal page with just the status code and
  message.
</p>

<h2>Error Handling Flow</h2>
<p>
  Here is the complete lifecycle of error handling in a MantiqJS application:
</p>

<ol>
  <li>An exception is thrown in a controller, middleware, or service.</li>
  <li>The HTTP kernel catches the exception and passes it to <code>handler.render(request, error)</code>.</li>
  <li>The handler checks if the error class is in <code>dontReport</code>. If not, <code>report()</code> is called.</li>
  <li>The handler determines the response format (JSON vs HTML) and debug mode.</li>
  <li>A <code>Response</code> is returned to the client.</li>
</ol>

<div class="note">
  The <code>render()</code> method is synchronous and returns a <code>Response</code> directly.
  The <code>report()</code> method is asynchronous but is called with <code>void</code> (fire-and-forget)
  so it doesn't block the response.
</div>
`
}
