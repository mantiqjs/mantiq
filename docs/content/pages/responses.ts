export default {
  title: 'Responses',
  content: `
<h2>Introduction</h2>
<p>
  Every route and controller action must ultimately return an HTTP response. MantiqJS provides two
  complementary tools for building responses: the <code>MantiqResponse</code> class with static
  factory methods for common response types, and the <code>ResponseBuilder</code> (accessed via the
  <code>response()</code> helper) for fluently building responses with headers, cookies, and status codes.
</p>

<h2>Basic Responses</h2>
<p>
  The simplest way to return a response is to return a value from your controller. MantiqJS
  automatically converts common return types:
</p>

<pre><code class="language-typescript">// String — sent as HTML with 200 status
async index(request: MantiqRequest) {
  return '&lt;h1&gt;Hello, world!&lt;/h1&gt;'
}

// Object or array — serialized as JSON with 200 status
async list(request: MantiqRequest) {
  return { users: [{ id: 1, name: 'Alice' }] }
}

// null or undefined — 204 No Content
async destroy(request: MantiqRequest) {
  await User.destroy(request.param('id'))
  return null
}</code></pre>

<p>
  For full control over status codes, headers, and content type, use the <code>MantiqResponse</code>
  factory methods or the <code>ResponseBuilder</code>.
</p>

<h2>MantiqResponse Factory Methods</h2>
<p>
  The <code>MantiqResponse</code> class provides static methods that return standard
  <code>Response</code> objects. Import it from <code>@mantiq/core</code>.
</p>

<pre><code class="language-typescript">import { MantiqResponse } from '@mantiq/core'</code></pre>

<h3>JSON Responses</h3>
<p>
  The most common response type for APIs. Automatically sets the <code>Content-Type</code> to
  <code>application/json</code> and serializes the data.
</p>

<pre><code class="language-typescript">// Basic JSON response (200)
return MantiqResponse.json({ message: 'Success', data: users })

// JSON with custom status code
return MantiqResponse.json({ data: user }, 201)

// JSON with custom headers
return MantiqResponse.json(
  { data: results },
  200,
  { 'X-Total-Count': '42' },
)</code></pre>

<h3>HTML Responses</h3>
<p>
  Returns an HTML response with the <code>Content-Type</code> set to
  <code>text/html; charset=utf-8</code>.
</p>

<pre><code class="language-typescript">// Basic HTML response
return MantiqResponse.html('&lt;h1&gt;Welcome&lt;/h1&gt;')

// HTML with custom status code
return MantiqResponse.html('&lt;h1&gt;Not Found&lt;/h1&gt;', 404)</code></pre>

<h3>Redirects</h3>
<p>
  Create redirect responses. The default status code is <code>302</code> (Found), but you can
  specify any 3xx status.
</p>

<pre><code class="language-typescript">// Temporary redirect (302)
return MantiqResponse.redirect('/dashboard')

// Permanent redirect (301)
return MantiqResponse.redirect('/new-url', 301)

// Redirect back after form submission (303 See Other)
return MantiqResponse.redirect('/posts', 303)</code></pre>

<h3>No Content</h3>
<p>
  Returns a <code>204 No Content</code> response with no body. Ideal for DELETE operations or
  actions that don't need to return data.
</p>

<pre><code class="language-typescript">return MantiqResponse.noContent()</code></pre>

<h3>File Downloads</h3>
<p>
  Send a file as a download. The response includes a <code>Content-Disposition: attachment</code>
  header that triggers the browser's download dialog.
</p>

<pre><code class="language-typescript">// Download from a buffer or string
const csvData = 'name,email\\nAlice,alice@example.com'
return MantiqResponse.download(csvData, 'users.csv', 'text/csv')

// Download binary data
const pdfBuffer = await generateReport()
return MantiqResponse.download(pdfBuffer, 'report.pdf', 'application/pdf')</code></pre>

<h3>Streaming Responses</h3>
<p>
  For large payloads or server-sent events, create a streaming response using a
  <code>ReadableStream</code>.
</p>

<pre><code class="language-typescript">return MantiqResponse.stream(async (controller) =&gt; {
  for (let i = 0; i &lt; 100; i++) {
    controller.enqueue(new TextEncoder().encode(\`data: \${i}\\n\\n\`))
    await Bun.sleep(100)
  }
  controller.close()
})</code></pre>

<h2>The Response Builder</h2>
<p>
  For more complex responses that need custom headers, cookies, or a combination of options,
  use the chainable <code>ResponseBuilder</code>. Access it via the <code>response()</code> helper.
</p>

<pre><code class="language-typescript">import { response } from '@mantiq/core'</code></pre>

<h3>Setting Status Codes</h3>
<pre><code class="language-typescript">return response()
  .status(201)
  .json({ data: newUser })</code></pre>

<h3>Setting Headers</h3>
<pre><code class="language-typescript">// Single header
return response()
  .header('X-Request-Id', requestId)
  .json({ data: results })

// Multiple headers at once
return response()
  .withHeaders({
    'X-Request-Id': requestId,
    'X-RateLimit-Remaining': '99',
    'Cache-Control': 'no-store',
  })
  .json({ data: results })</code></pre>

<h3>Setting Cookies</h3>
<p>
  Attach cookies to the response with fine-grained control over cookie options.
</p>

<pre><code class="language-typescript">return response()
  .cookie('theme', 'dark', {
    maxAge: 60 * 60 * 24 * 365,  // 1 year in seconds
    path: '/',
    httpOnly: false,
    secure: true,
    sameSite: 'Lax',
  })
  .json({ success: true })</code></pre>

<p>The <code>CookieOptions</code> interface supports:</p>
<ul>
  <li><code>maxAge</code> — Cookie lifetime in seconds.</li>
  <li><code>expires</code> — Absolute expiration date.</li>
  <li><code>path</code> — URL path the cookie is valid for.</li>
  <li><code>domain</code> — Domain the cookie is valid for.</li>
  <li><code>secure</code> — Only send over HTTPS.</li>
  <li><code>httpOnly</code> — Not accessible via JavaScript.</li>
  <li><code>sameSite</code> — <code>'Strict'</code>, <code>'Lax'</code>, or <code>'None'</code>.</li>
</ul>

<h3>Builder Finalization Methods</h3>
<p>
  The builder is finalized by calling one of these methods, which returns the actual <code>Response</code>:
</p>

<pre><code class="language-typescript">// JSON response
return response().status(200).json({ data })

// HTML response
return response().status(200).html('&lt;h1&gt;Hello&lt;/h1&gt;')

// Redirect
return response().status(301).redirect('/new-location')

// Without explicit status, redirect defaults to 302
return response().redirect('/dashboard')</code></pre>

<h3>Complete Builder Example</h3>
<pre><code class="language-typescript">async store(request: MantiqRequest): Promise&lt;Response&gt; {
  const data = await request.only('name', 'email')
  const user = await User.create(data)

  return response()
    .status(201)
    .header('X-Resource-Id', String(user.id))
    .cookie('last_created', String(user.id), { maxAge: 3600 })
    .json({ data: user })
}</code></pre>

<h2>Vite SSR Responses</h2>
<p>
  When building full-stack applications with a frontend framework (React, Vue, etc.), use the
  <code>vite()</code> helper from <code>@mantiq/vite</code> to render server-side pages.
</p>

<pre><code class="language-typescript">import { vite } from '@mantiq/vite'

async show(request: MantiqRequest): Promise&lt;Response&gt; {
  return vite().render(request, {
    page: 'Dashboard',
    entry: ['src/style.css', 'src/main.tsx'],
    title: 'Dashboard',
    data: {
      user: request.user(),
      stats: await getStats(),
    },
  })
}</code></pre>

<p>The <code>render()</code> options include:</p>
<ul>
  <li><code>page</code> — The page component name to render.</li>
  <li><code>entry</code> — Vite entry points (CSS and JS files).</li>
  <li><code>title</code> — The HTML page title.</li>
  <li><code>head</code> — Additional HTML to inject into the <code>&lt;head&gt;</code>.</li>
  <li><code>data</code> — Props passed to the page component, serialized and available on both server and client.</li>
</ul>

<h2>Response Patterns</h2>

<h3>API Responses</h3>
<pre><code class="language-typescript">// Success with data
return MantiqResponse.json({ data: users }, 200)

// Created
return MantiqResponse.json({ data: newUser }, 201)

// Validation error
return MantiqResponse.json({
  error: { message: 'Validation failed', errors: { email: ['Email is required'] } }
}, 422)

// Not found
return MantiqResponse.json({ error: { message: 'User not found' } }, 404)

// No content (successful delete)
return MantiqResponse.noContent()</code></pre>

<h3>Conditional Responses</h3>
<pre><code class="language-typescript">async show(request: MantiqRequest): Promise&lt;Response&gt; {
  const user = await User.find(request.param('id'))

  if (!user) {
    if (request.expectsJson()) {
      return MantiqResponse.json({ error: { message: 'Not found' } }, 404)
    }
    return MantiqResponse.html('&lt;h1&gt;404&lt;/h1&gt;', 404)
  }

  if (request.expectsJson()) {
    return MantiqResponse.json({ data: user })
  }

  return vite().render(request, {
    page: 'UserProfile',
    entry: ['src/main.tsx'],
    data: { user },
  })
}</code></pre>

<h2>Method Reference</h2>

<h3>MantiqResponse (Static Methods)</h3>
<table>
  <thead>
    <tr><th>Method</th><th>Description</th></tr>
  </thead>
  <tbody>
    <tr><td><code>json(data, status?, headers?)</code></td><td>JSON response</td></tr>
    <tr><td><code>html(content, status?)</code></td><td>HTML response</td></tr>
    <tr><td><code>redirect(url, status?)</code></td><td>Redirect response (default 302)</td></tr>
    <tr><td><code>noContent()</code></td><td>204 No Content</td></tr>
    <tr><td><code>download(content, filename, mimeType?)</code></td><td>File download</td></tr>
    <tr><td><code>stream(callback)</code></td><td>Streaming response</td></tr>
  </tbody>
</table>

<h3>ResponseBuilder (Chainable)</h3>
<table>
  <thead>
    <tr><th>Method</th><th>Description</th></tr>
  </thead>
  <tbody>
    <tr><td><code>status(code)</code></td><td>Set HTTP status code</td></tr>
    <tr><td><code>header(key, value)</code></td><td>Set a single response header</td></tr>
    <tr><td><code>withHeaders(headers)</code></td><td>Set multiple headers at once</td></tr>
    <tr><td><code>cookie(name, value, options?)</code></td><td>Attach a cookie</td></tr>
    <tr><td><code>json(data)</code></td><td>Finalize as JSON response</td></tr>
    <tr><td><code>html(content)</code></td><td>Finalize as HTML response</td></tr>
    <tr><td><code>redirect(url)</code></td><td>Finalize as redirect</td></tr>
  </tbody>
</table>
`
}
