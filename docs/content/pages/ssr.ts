export default {
  title: 'Server-Side Rendering',
  content: `
<h2>Introduction</h2>

<p>Server-Side Rendering (SSR) in MantiqJS renders your frontend components to HTML on the server before sending them to the browser. This improves first-load performance, SEO, and perceived load times. The SSR integration is built into <code>@mantiq/vite</code> and works with React, Vue, Svelte, or any framework that supports server-side rendering to a string.</p>

<p>MantiqJS SSR follows a simple model: your SSR entry file exports a <code>render(url, data)</code> function that returns HTML. The framework handles the rest &mdash; including dev mode with Vite's <code>ssrLoadModule</code> for instant HMR, and production mode with a pre-built bundle.</p>

<h2>Configuration</h2>

<p>Enable SSR by adding the <code>ssr</code> section to your <code>config/vite.ts</code>:</p>

<pre><code class="language-typescript">// config/vite.ts
import { env } from '@mantiq/core'

export default {
  devServerUrl: env('VITE_DEV_SERVER_URL', 'http://localhost:5173'),
  buildDir: 'build',
  publicDir: import.meta.dir + '/../public',
  manifest: '.vite/manifest.json',
  reactRefresh: true,
  rootElement: 'app',
  ssr: {
    entry: 'src/ssr.tsx',
    bundle: 'bootstrap/ssr/ssr.js',
  },
}</code></pre>

<table>
  <thead>
    <tr><th>Option</th><th>Default</th><th>Description</th></tr>
  </thead>
  <tbody>
    <tr><td><code>ssr.entry</code></td><td>&mdash;</td><td>Path to the SSR entry module. This file exports the <code>render()</code> function used during server rendering.</td></tr>
    <tr><td><code>ssr.bundle</code></td><td><code>'bootstrap/ssr/ssr.js'</code></td><td>Path to the pre-built SSR bundle used in production. Build this with <code>vite build --ssr</code>.</td></tr>
  </tbody>
</table>

<p>When <code>ssr.entry</code> is set, <code>vite().isSSR()</code> returns <code>true</code> and the page rendering pipeline will attempt server-side rendering before falling back to the client-side shell.</p>

<h2>The SSR Entry File</h2>

<p>Your SSR entry module must export a <code>render</code> function that accepts a URL and optional data, and returns an object with an <code>html</code> string (and optionally a <code>head</code> string for injecting meta tags).</p>

<h3>React Example</h3>

<pre><code class="language-typescript">// src/ssr.tsx
import { renderToString } from 'react-dom/server'
import { MantiqApp } from './App.tsx'
import { pages } from './pages.ts'

export function render(_url: string, data?: Record&lt;string, any&gt;) {
  const html = renderToString(
    &lt;MantiqApp pages={pages} initialData={data} /&gt;
  )
  return { html }
}</code></pre>

<h3>With Head Tags</h3>

<p>You can return a <code>head</code> string to inject additional tags into the document <code>&lt;head&gt;</code>:</p>

<pre><code class="language-typescript">export function render(url: string, data?: Record&lt;string, any&gt;) {
  const html = renderToString(&lt;App data={data} /&gt;)
  const head = '&lt;meta property="og:title" content="My App"&gt;'
  return { html, head }
}</code></pre>

<h3>The SSR Module Contract</h3>

<pre><code class="language-typescript">interface SSRModule {
  render(
    url: string,
    data?: Record&lt;string, any&gt;
  ): Promise&lt;SSRResult&gt; | SSRResult
}

interface SSRResult {
  html: string
  head?: string
}</code></pre>

<p>The <code>render</code> function can be synchronous or asynchronous. MantiqJS will <code>await</code> it in either case.</p>

<h2>How SSR Works</h2>

<p>The rendering pipeline follows this flow when <code>vite().render()</code> or <code>vite().page()</code> is called:</p>

<ol>
  <li><strong>Client navigation check:</strong> If the request has an <code>X-Mantiq: true</code> header, skip SSR entirely and return JSON. The client app handles page transitions in-browser.</li>
  <li><strong>SSR render:</strong> Load the SSR module and call <code>render(url, data)</code>. The returned HTML is injected into the root element.</li>
  <li><strong>HTML assembly:</strong> The full document is built with asset tags, SSR content inside the root div, and page data serialised to <code>window.__MANTIQ_DATA__</code>.</li>
  <li><strong>Client hydration:</strong> The browser loads the client bundle, detects existing SSR content in the root element, and hydrates rather than re-rendering from scratch.</li>
</ol>

<pre><code class="language-html">&lt;!-- Server output with SSR --&gt;
&lt;div id="app"&gt;&lt;div class="dashboard"&gt;&lt;h1&gt;Welcome, Alice&lt;/h1&gt;...&lt;/div&gt;&lt;/div&gt;
&lt;script&gt;window.__MANTIQ_DATA__ = {"_page":"Dashboard","user":{"name":"Alice"}}&lt;/script&gt;</code></pre>

<p>If SSR rendering throws an error, MantiqJS falls back to a client-side-only shell (an empty root div). The page still works &mdash; it just renders on the client instead. This prevents SSR errors from causing full page failures.</p>

<h2>The <code>render()</code> Method</h2>

<p>The <code>vite().render()</code> method is the primary way to render pages. It implements the MantiqJS navigation protocol, serving as both an SSR renderer and a JSON API endpoint.</p>

<pre><code class="language-typescript">import { vite } from '@mantiq/vite'

router.get('/dashboard', async (request) =&gt; {
  const users = await User.all()

  return vite().render(request, {
    page: 'Dashboard',
    entry: ['src/style.css', 'src/main.tsx'],
    data: { users },
    title: 'Dashboard',
    head: '&lt;meta name="robots" content="noindex"&gt;',
  })
})</code></pre>

<h3>Response Behaviour</h3>

<table>
  <thead>
    <tr><th>Request Header</th><th>Response</th><th>Content-Type</th></tr>
  </thead>
  <tbody>
    <tr><td>No <code>X-Mantiq</code> header</td><td>Full HTML document with SSR content</td><td><code>text/html</code></td></tr>
    <tr><td><code>X-Mantiq: true</code></td><td>JSON with page name, URL, and data</td><td><code>application/json</code></td></tr>
  </tbody>
</table>

<p>The JSON response includes <code>_page</code> (the component name) and <code>_url</code> (the current path), which the client-side router uses to render the correct page component without a full page reload.</p>

<h2>Development Mode</h2>

<p>In development, MantiqJS creates an embedded Vite dev server in middleware mode and uses <code>ssrLoadModule()</code> to load your SSR entry file. This gives you:</p>

<ul>
  <li><strong>Hot Module Replacement:</strong> Changes to your SSR entry or any of its dependencies are picked up instantly without restarting the server.</li>
  <li><strong>TypeScript/JSX transform:</strong> Vite handles all transforms, so your SSR code uses the same pipeline as the client bundle.</li>
  <li><strong>Error stack traces:</strong> When SSR throws in dev mode, Vite fixes the stack trace to point to your original source files.</li>
</ul>

<pre><code class="language-typescript">// Internally, in dev mode:
const viteServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
})

// Loads your SSR entry with full HMR support
const mod = await viteServer.ssrLoadModule('src/ssr.tsx')</code></pre>

<p>In dev mode, the SSR module is loaded fresh on every request (not cached), so you always get the latest version of your code during development.</p>

<h2>Production Build</h2>

<p>For production, build the SSR bundle separately from the client bundle:</p>

<pre><code class="language-bash"># 1. Build client assets (generates manifest + hashed files)
npx vite build

# 2. Build SSR bundle (generates a single Node/Bun-compatible module)
npx vite build --ssr src/ssr.tsx --outDir bootstrap/ssr</code></pre>

<p>The SSR build produces a single JavaScript file at <code>bootstrap/ssr/ssr.js</code> (or wherever <code>ssr.bundle</code> points). In production, MantiqJS imports this file directly instead of using Vite's dev server.</p>

<p>If the SSR bundle file does not exist at the configured path in production, MantiqJS will throw a <code>ViteSSRBundleNotFoundError</code>. Make sure your deployment pipeline includes both build steps.</p>

<h3>Build Script Example</h3>

<p>Add these scripts to your <code>package.json</code>:</p>

<pre><code class="language-json">{
  "scripts": {
    "build": "vite build && vite build --ssr src/ssr.tsx --outDir bootstrap/ssr",
    "dev": "vite dev"
  }
}</code></pre>

<h2>Hydration on the Client</h2>

<p>On the client side, your entry file should detect whether SSR content exists and hydrate accordingly:</p>

<pre><code class="language-typescript">// src/main.tsx
import { hydrateRoot, createRoot } from 'react-dom/client'
import { MantiqApp } from './App.tsx'
import { pages } from './pages.ts'

const root = document.getElementById('app')!
const app = &lt;MantiqApp pages={pages} /&gt;

// Hydrate if SSR content exists, otherwise CSR mount
root.innerHTML.trim()
  ? hydrateRoot(root, app)
  : createRoot(root).render(app)</code></pre>

<p>This approach works for both SSR and non-SSR deployments. If the server renders HTML into the root div, <code>hydrateRoot</code> preserves the existing DOM and attaches event listeners. If the root is empty (CSR fallback), <code>createRoot</code> performs a normal client-side render.</p>

<h2>SSR Without a Framework</h2>

<p>SSR is not limited to React. Any framework that can render to a string works. The only requirement is that your SSR entry exports a <code>render(url, data)</code> function.</p>

<h3>Vue Example</h3>

<pre><code class="language-typescript">// src/ssr.ts
import { renderToString } from 'vue/server-renderer'
import { createApp } from './app.ts'

export async function render(url: string, data?: Record&lt;string, any&gt;) {
  const app = createApp(data)
  const html = await renderToString(app)
  return { html }
}</code></pre>

<h3>Svelte Example</h3>

<pre><code class="language-typescript">// src/ssr.ts
import App from './App.svelte'

export function render(url: string, data?: Record&lt;string, any&gt;) {
  const { html, head } = App.render(data)
  return { html, head }
}</code></pre>
`
}
