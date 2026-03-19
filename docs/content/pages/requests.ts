export default {
  title: 'Requests',
  content: `
<h2>Introduction</h2>
<p>
  The <code>MantiqRequest</code> object wraps the incoming HTTP request and provides a rich API for
  accessing input data, headers, files, route parameters, sessions, and authentication state. Every
  controller action and closure receives a <code>MantiqRequest</code> instance as its first argument.
</p>

<pre><code class="language-typescript">import type { MantiqRequest } from '@mantiq/core'

router.get('/users/:id', async (request: MantiqRequest) =&gt; {
  const id = request.param('id')
  const format = request.query('format', 'json')
  // ...
})</code></pre>

<h2>Request URL and Method</h2>
<p>
  MantiqJS provides several methods for inspecting the request's URL and HTTP method.
</p>

<pre><code class="language-typescript">// Given: POST https://example.com/users?page=2

request.method()    // 'POST'
request.path()      // '/users'
request.url()       // '/users?page=2'
request.fullUrl()   // 'https://example.com/users?page=2'</code></pre>

<table>
  <thead>
    <tr><th>Method</th><th>Returns</th><th>Description</th></tr>
  </thead>
  <tbody>
    <tr><td><code>method()</code></td><td><code>string</code></td><td>The HTTP method in uppercase (e.g., <code>'GET'</code>, <code>'POST'</code>).</td></tr>
    <tr><td><code>path()</code></td><td><code>string</code></td><td>The URL pathname without the query string.</td></tr>
    <tr><td><code>url()</code></td><td><code>string</code></td><td>The pathname plus the query string.</td></tr>
    <tr><td><code>fullUrl()</code></td><td><code>string</code></td><td>The complete URL including protocol, host, path, and query string.</td></tr>
  </tbody>
</table>

<h2>Query String Input</h2>
<p>
  The <code>query()</code> method reads values from the URL's query string. It is synchronous because
  query parameters are parsed from the URL, not the request body.
</p>

<pre><code class="language-typescript">// GET /search?q=mantiq&amp;page=2

// Get a single value with optional default
const q = request.query('q')                // 'mantiq'
const page = request.query('page', '1')     // '2'
const missing = request.query('sort', 'id') // 'id' (default)

// Get all query parameters as an object
const allQuery = request.query()            // { q: 'mantiq', page: '2' }</code></pre>

<h2>Request Body Input</h2>
<p>
  The <code>input()</code> method retrieves values from the request body (JSON, form-urlencoded,
  or multipart). It merges body data with query string data, with body values taking precedence.
  Since body parsing is asynchronous, <code>input()</code> returns a <code>Promise</code>.
</p>

<pre><code class="language-typescript">// Get a single input value
const name = await request.input('name')
const role = await request.input('role', 'user')  // with default

// Get all merged input (query + body)
const all = await request.input()</code></pre>

<h3>Retrieving a Subset of Input</h3>
<p>
  Use <code>only()</code> and <code>except()</code> to retrieve a filtered subset of the input data.
  Both return promises.
</p>

<pre><code class="language-typescript">// Only get specific keys
const data = await request.only('name', 'email', 'password')
// { name: 'Alice', email: 'alice@example.com', password: '...' }

// Get everything except certain keys
const safe = await request.except('password', '_token')
// { name: 'Alice', email: 'alice@example.com' }</code></pre>

<h3>Checking for Input Presence</h3>
<pre><code class="language-typescript">// Check if keys exist (synchronous — checks query + already-parsed body)
if (request.has('email', 'password')) {
  // Both 'email' and 'password' are present
}

// Check if keys exist AND are non-empty (async — parses body if needed)
if (await request.filled('name', 'email')) {
  // Both values are present and not empty strings/null/undefined
}</code></pre>

<div class="note">
  <code>has()</code> checks for key existence, while <code>filled()</code> additionally verifies
  that the values are not empty strings, <code>null</code>, or <code>undefined</code>.
  <code>has()</code> is synchronous and only checks query params and already-parsed body data;
  <code>filled()</code> is async and will parse the body if needed.
</div>

<h2>Headers</h2>
<p>
  Access request headers with <code>header()</code> and <code>headers()</code>. Header names are
  case-insensitive.
</p>

<pre><code class="language-typescript">// Get a single header
const contentType = request.header('Content-Type')
const auth = request.header('Authorization', 'none')  // with default

// Get all headers as a plain object
const allHeaders = request.headers()
// { 'content-type': 'application/json', 'authorization': 'Bearer ...', ... }</code></pre>

<h3>Additional Header Helpers</h3>

<pre><code class="language-typescript">// Client IP address (from X-Forwarded-For, X-Real-IP, or fallback)
const ip = request.ip()

// User-Agent string
const ua = request.userAgent()

// Content negotiation — returns the first accepted type, or false
const accepted = request.accepts('text/html', 'application/json')

// Check if the client expects a JSON response
if (request.expectsJson()) {
  return MantiqResponse.json({ error: 'Not found' }, 404)
}

// Check if the request body is JSON
if (request.isJson()) {
  const data = await request.input()
}</code></pre>

<h2>Cookies</h2>
<p>
  Read cookies from the request. When <code>EncryptCookies</code> middleware is active, cookies
  are automatically decrypted before your code sees them.
</p>

<pre><code class="language-typescript">const theme = request.cookie('theme', 'light')   // with default
const token = request.cookie('session_id')</code></pre>

<h2>Route Parameters</h2>
<p>
  Route parameters captured from the URL pattern (e.g., <code>:id</code> in <code>/users/:id</code>)
  are available via the <code>param()</code> method. These are set by the router when the route matches.
</p>

<pre><code class="language-typescript">// Route: /posts/:postId/comments/:commentId
const postId = request.param('postId')
const commentId = request.param('commentId')
const fallback = request.param('missing', 'default')

// Get all route parameters
const params = request.params()
// { postId: '42', commentId: '7' }</code></pre>

<div class="warning">
  Route parameters are always strings. Remember to convert them to the appropriate type
  (e.g., <code>Number(request.param('id'))</code>) when using them in database queries or
  arithmetic operations.
</div>

<h2>Uploaded Files</h2>
<p>
  When handling <code>multipart/form-data</code> requests, uploaded files are available through
  the <code>file()</code> and <code>files()</code> methods. Each file is an <code>UploadedFile</code>
  instance.
</p>

<pre><code class="language-typescript">// Get a single file
const avatar = request.file('avatar')
if (avatar) {
  console.log(avatar.name)     // Original filename
  console.log(avatar.size)     // Size in bytes
  console.log(avatar.type)     // MIME type
}

// Get multiple files for the same field
const photos = request.files('photos')
for (const photo of photos) {
  // Process each uploaded file
}

// Check if a file was uploaded
if (request.hasFile('document')) {
  const doc = request.file('document')
  // ...
}</code></pre>

<h2>Session</h2>
<p>
  Access the session store through the request. The <code>StartSession</code> middleware must
  be active for session access to work.
</p>

<pre><code class="language-typescript">const session = request.session()

// Get a session value
const userId = session.get('user_id')

// Set a session value
session.put('locale', 'en')

// Flash data (available only on the next request)
session.flash('success', 'Profile updated!')

// Check if session is available
if (request.hasSession()) {
  // Session middleware is active
}</code></pre>

<h2>Authentication</h2>
<p>
  The request provides convenience methods for checking and accessing the authenticated user.
  These are set by your authentication middleware.
</p>

<pre><code class="language-typescript">// Check if the user is authenticated
if (request.isAuthenticated()) {
  // Get the authenticated user
  const user = request.user()
  console.log(user.name)
}

// With type parameter for type safety
interface AuthUser {
  id: number
  name: string
  email: string
}

const user = request.user&lt;AuthUser&gt;()
if (user) {
  console.log(user.email)  // Fully typed
}</code></pre>

<h2>Content Type Detection</h2>
<p>
  MantiqJS provides helpers to detect what the client is sending and expecting.
</p>

<pre><code class="language-typescript">// Is the request body JSON?
request.isJson()        // true if Content-Type includes 'application/json'

// Does the client want JSON back?
request.expectsJson()   // true if Accept includes 'application/json'

// Content negotiation — find the best match
const type = request.accepts('text/html', 'application/json', 'text/plain')
// Returns the first accepted type or false</code></pre>

<h2>Accessing the Raw Request</h2>
<p>
  If you need access to the underlying Bun <code>Request</code> object (for example, to use
  Bun-specific APIs), call <code>raw()</code>.
</p>

<pre><code class="language-typescript">const bunRequest: Request = request.raw()

// Access Bun-specific features
const body = await bunRequest.arrayBuffer()
const signal = bunRequest.signal</code></pre>

<div class="note">
  In most cases you should use the <code>MantiqRequest</code> API rather than the raw Bun request.
  The MantiqRequest provides caching, lazy parsing, and a consistent interface that works correctly
  with middleware like <code>EncryptCookies</code>.
</div>

<h2>Method Reference</h2>
<table>
  <thead>
    <tr><th>Method</th><th>Return Type</th><th>Description</th></tr>
  </thead>
  <tbody>
    <tr><td><code>method()</code></td><td><code>string</code></td><td>HTTP method (uppercase)</td></tr>
    <tr><td><code>path()</code></td><td><code>string</code></td><td>URL pathname</td></tr>
    <tr><td><code>url()</code></td><td><code>string</code></td><td>Pathname + query string</td></tr>
    <tr><td><code>fullUrl()</code></td><td><code>string</code></td><td>Complete URL</td></tr>
    <tr><td><code>query(key?, default?)</code></td><td><code>string | Record</code></td><td>Query string value(s)</td></tr>
    <tr><td><code>input(key?, default?)</code></td><td><code>Promise&lt;any&gt;</code></td><td>Merged query + body input</td></tr>
    <tr><td><code>only(...keys)</code></td><td><code>Promise&lt;Record&gt;</code></td><td>Subset of input</td></tr>
    <tr><td><code>except(...keys)</code></td><td><code>Promise&lt;Record&gt;</code></td><td>Input minus specified keys</td></tr>
    <tr><td><code>has(...keys)</code></td><td><code>boolean</code></td><td>Check key existence</td></tr>
    <tr><td><code>filled(...keys)</code></td><td><code>Promise&lt;boolean&gt;</code></td><td>Check keys are non-empty</td></tr>
    <tr><td><code>header(key, default?)</code></td><td><code>string | undefined</code></td><td>Single header value</td></tr>
    <tr><td><code>headers()</code></td><td><code>Record</code></td><td>All headers</td></tr>
    <tr><td><code>cookie(key, default?)</code></td><td><code>string | undefined</code></td><td>Cookie value</td></tr>
    <tr><td><code>param(key, default?)</code></td><td><code>any</code></td><td>Route parameter</td></tr>
    <tr><td><code>params()</code></td><td><code>Record</code></td><td>All route parameters</td></tr>
    <tr><td><code>file(key)</code></td><td><code>UploadedFile | null</code></td><td>Single uploaded file</td></tr>
    <tr><td><code>files(key)</code></td><td><code>UploadedFile[]</code></td><td>Multiple uploaded files</td></tr>
    <tr><td><code>hasFile(key)</code></td><td><code>boolean</code></td><td>Check if file was uploaded</td></tr>
    <tr><td><code>session()</code></td><td><code>SessionStore</code></td><td>Session store</td></tr>
    <tr><td><code>user&lt;T&gt;()</code></td><td><code>T | null</code></td><td>Authenticated user</td></tr>
    <tr><td><code>isAuthenticated()</code></td><td><code>boolean</code></td><td>Auth check</td></tr>
    <tr><td><code>ip()</code></td><td><code>string</code></td><td>Client IP address</td></tr>
    <tr><td><code>userAgent()</code></td><td><code>string</code></td><td>User-Agent header</td></tr>
    <tr><td><code>expectsJson()</code></td><td><code>boolean</code></td><td>Client wants JSON</td></tr>
    <tr><td><code>isJson()</code></td><td><code>boolean</code></td><td>Body is JSON</td></tr>
    <tr><td><code>accepts(...types)</code></td><td><code>string | false</code></td><td>Content negotiation</td></tr>
    <tr><td><code>raw()</code></td><td><code>Request</code></td><td>Underlying Bun Request</td></tr>
  </tbody>
</table>
`
}
