export default {
  title: 'Sessions',
  content: `
<h2>Introduction</h2>
<p>Sessions allow you to store information about a user across multiple HTTP requests. Since HTTP is a stateless protocol, sessions provide the mechanism for maintaining state between requests. MantiqJS supports multiple session backends: Memory (for development), File (for production), and Cookie (client-side storage).</p>

<h2>Configuration</h2>
<p>Session settings are defined in <code>config/session.ts</code>:</p>

<pre><code class="language-typescript">import { env } from '@mantiq/core'

export default {
  driver: env('SESSION_DRIVER', 'memory'),
  lifetime: 120,                          // minutes
  cookie: 'mantiq_session',
  path: '/',
  domain: env('SESSION_DOMAIN', undefined),
  secure: env('SESSION_SECURE_COOKIE', false),
  httpOnly: true,
  sameSite: 'Lax' as const,
  files: 'storage/sessions',              // for the file driver
}
</code></pre>

<h3>Session Handlers</h3>
<table>
  <thead><tr><th>Driver</th><th>Description</th><th>Best For</th></tr></thead>
  <tbody>
    <tr><td><code>memory</code></td><td>Stores sessions in process memory. Lost on restart.</td><td>Development</td></tr>
    <tr><td><code>file</code></td><td>Stores sessions as files in the configured directory.</td><td>Production (single server)</td></tr>
    <tr><td><code>cookie</code></td><td>Stores encrypted session data in the client cookie.</td><td>Stateless deployments</td></tr>
  </tbody>
</table>

<h3>Configuration Options</h3>
<table>
  <thead><tr><th>Option</th><th>Description</th></tr></thead>
  <tbody>
    <tr><td><code>lifetime</code></td><td>Session lifetime in minutes. After this period of inactivity, the session expires.</td></tr>
    <tr><td><code>cookie</code></td><td>The name of the session cookie sent to the client.</td></tr>
    <tr><td><code>path</code></td><td>The cookie path. Typically <code>/</code> for the entire site.</td></tr>
    <tr><td><code>secure</code></td><td>If true, the cookie is only sent over HTTPS.</td></tr>
    <tr><td><code>httpOnly</code></td><td>If true, the cookie is inaccessible to JavaScript. Always recommended.</td></tr>
    <tr><td><code>sameSite</code></td><td>Controls cross-site cookie behavior: <code>Lax</code>, <code>Strict</code>, or <code>None</code>.</td></tr>
  </tbody>
</table>

<h2>The StartSession Middleware</h2>
<p>Sessions are managed by the <code>StartSession</code> middleware, which is included in the default middleware stack. This middleware:</p>
<ol>
  <li>Reads the session ID from the incoming request cookie</li>
  <li>Loads the session data from the configured handler</li>
  <li>Makes the session available on the request object</li>
  <li>After the response, saves the session data and sets the session cookie</li>
  <li>Ages flash data (moves "new" flash to "old", removes expired flash)</li>
  <li>Runs garbage collection on expired sessions (probabilistic)</li>
</ol>

<h2>Using Sessions</h2>
<p>Access the session through the request object in your controllers:</p>

<pre><code class="language-typescript">class DashboardController {
  async index(request: MantiqRequest) {
    const session = request.session()

    // Read a value
    const username = session.get('username')

    // Read with a default
    const theme = session.get('theme', 'light')

    return MantiqResponse.json({ username, theme })
  }
}
</code></pre>

<h3>Storing Data</h3>

<pre><code class="language-typescript">// Store a value
session.put('key', 'value')

// Store any serializable value
session.put('preferences', { theme: 'dark', language: 'en' })
session.put('cart_count', 5)
</code></pre>

<h3>Retrieving Data</h3>

<pre><code class="language-typescript">// Get a value (returns undefined if not set)
const value = session.get('key')

// Get with a default value
const locale = session.get('locale', 'en')

// Get with type hint
const prefs = session.get&lt;{ theme: string }&gt;('preferences')

// Check if a key exists
if (session.has('username')) {
  // key exists in session
}

// Get all session data
const allData = session.all()

// Get and remove a value in one step
const message = session.pull('success_message')
</code></pre>

<h3>Removing Data</h3>

<pre><code class="language-typescript">// Remove a specific key
session.forget('key')

// Remove all session data
session.flush()
</code></pre>

<h2>Flash Data</h2>
<p>Flash data is session data that only persists for the <strong>next</strong> request. This is useful for status messages after form submissions:</p>

<pre><code class="language-typescript">class PostController {
  async store(request: MantiqRequest) {
    const post = await Post.create(await request.input())

    // Flash a success message for the next request
    request.session().flash('success', 'Post created successfully!')

    return MantiqResponse.redirect('/posts')
  }

  async index(request: MantiqRequest) {
    const session = request.session()

    // Read flash data (available only for this request)
    const success = session.get('success')

    const posts = await Post.all()
    return MantiqResponse.json({ posts, flash: { success } })
  }
}
</code></pre>

<h3>Keeping Flash Data</h3>
<p>If you need flash data to persist for an additional request, use <code>reflash()</code> or <code>keep()</code>:</p>

<pre><code class="language-typescript">// Keep ALL flash data for one more request
session.reflash()

// Keep specific flash keys for one more request
session.keep('success', 'warning')
</code></pre>

<h2>Session ID Management</h2>

<pre><code class="language-typescript">// Get the current session ID
const id = session.getId()

// Regenerate the session ID (prevents session fixation)
await session.regenerate()

// Regenerate and destroy the old session data
await session.regenerate(true)

// Invalidate the session entirely (flush data + regenerate ID)
await session.invalidate()
</code></pre>

<p>Session regeneration happens automatically when a user logs in via <code>auth().login()</code>, preventing session fixation attacks.</p>

<h2>CSRF Protection</h2>
<p>The session store manages the CSRF token used for protecting against cross-site request forgery:</p>

<pre><code class="language-typescript">// Get the current CSRF token
const token = session.token()

// Regenerate the CSRF token
session.regenerateToken()
</code></pre>

<p>The CSRF token is automatically generated on first access and stored in the session. Include it in your forms or as a request header for the CSRF middleware to validate.</p>

<h2>Session Handler Contract</h2>
<p>All session drivers implement the <code>SessionHandler</code> interface:</p>

<pre><code class="language-typescript">interface SessionHandler {
  read(sessionId: string): Promise&lt;string&gt;
  write(sessionId: string, data: string): Promise&lt;void&gt;
  destroy(sessionId: string): Promise&lt;void&gt;
  gc(maxLifetimeSeconds: number): Promise&lt;void&gt;
}
</code></pre>

<p>You can implement this interface to create custom session drivers (e.g., database-backed or Redis-backed sessions).</p>

<h2>Cookie Session Driver</h2>
<p>The cookie driver stores all session data in an encrypted cookie on the client. This is useful for stateless deployments where you cannot share server-side session storage across multiple instances.</p>

<p>Cookie sessions have a size limit of roughly 4 KB, so store only essential data when using this driver. The data is encrypted with your <code>APP_KEY</code> &mdash; users cannot read or tamper with it.</p>
`
}
