export default {
  title: 'Vite Integration',
  content: `
<h2>Introduction</h2>

<p>MantiqJS uses <a href="https://vite.dev" target="_blank">Vite</a> as its frontend build tool. The <code>@mantiq/vite</code> package provides seamless integration between your Bun-powered backend and Vite's lightning-fast dev server and optimised production builds. It handles dev/prod detection, asset tag generation, manifest reading, and full HTML page rendering.</p>

<h2>Installation &amp; Setup</h2>

<p>The <code>@mantiq/vite</code> package is included by default in all MantiqJS starter kits. If you are adding it to an existing project:</p>

<pre><code class="language-bash">bun add @mantiq/vite</code></pre>

<h3>Registering the Service Provider</h3>

<p>Register <code>ViteServiceProvider</code> in your application's provider list. It binds the <code>Vite</code> class as a singleton in the service container and auto-detects dev mode during boot.</p>

<pre><code class="language-typescript">import { ViteServiceProvider } from '@mantiq/vite'

// In your app bootstrap (e.g. bootstrap/app.ts)
await app.registerProviders([
  // ... other providers
  ViteServiceProvider,
])</code></pre>

<p>During the <code>boot()</code> phase, the provider calls <code>vite.initialize()</code>, which checks for a hot file to determine whether the Vite dev server is running.</p>

<h2>Configuration</h2>

<p>Create a <code>config/vite.ts</code> file in your project root. The provider reads this config from the <code>ConfigRepository</code> automatically.</p>

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

<h3>Config Options Reference</h3>

<table>
  <thead>
    <tr><th>Option</th><th>Default</th><th>Description</th></tr>
  </thead>
  <tbody>
    <tr><td><code>devServerUrl</code></td><td><code>'http://localhost:5173'</code></td><td>URL of the Vite dev server. Used for HMR and asset loading in development.</td></tr>
    <tr><td><code>buildDir</code></td><td><code>'build'</code></td><td>Build output directory, relative to <code>publicDir</code>. This is where Vite writes compiled assets.</td></tr>
    <tr><td><code>publicDir</code></td><td><code>'public'</code></td><td>Absolute path to the public directory served by your web server.</td></tr>
    <tr><td><code>manifest</code></td><td><code>'.vite/manifest.json'</code></td><td>Path to the Vite manifest file inside <code>buildDir</code>.</td></tr>
    <tr><td><code>reactRefresh</code></td><td><code>false</code></td><td>Inject the React Fast Refresh preamble in dev mode. Required for React HMR.</td></tr>
    <tr><td><code>rootElement</code></td><td><code>'app'</code></td><td>The ID of the root DOM element where your frontend app mounts.</td></tr>
    <tr><td><code>hotFile</code></td><td><code>'hot'</code></td><td>Filename of the hot file, relative to <code>publicDir</code>. Presence indicates dev mode.</td></tr>
    <tr><td><code>ssr.entry</code></td><td>&mdash;</td><td>SSR entry module path (e.g. <code>'src/ssr.tsx'</code>). Enables server-side rendering when set.</td></tr>
    <tr><td><code>ssr.bundle</code></td><td><code>'bootstrap/ssr/ssr.js'</code></td><td>Path to the pre-built SSR bundle used in production.</td></tr>
  </tbody>
</table>

<h2>Dev Mode Detection</h2>

<p>MantiqJS detects whether the Vite dev server is running by checking for a <strong>hot file</strong> in your public directory. When you run <code>vite dev</code>, the dev server writes this file. When you stop the server, it is removed.</p>

<pre><code class="language-typescript">import { vite } from '@mantiq/vite'

if (vite().isDev()) {
  console.log('Dev server URL:', vite().devServerUrl())
}</code></pre>

<p>In <strong>dev mode</strong>, asset tags point directly to the Vite dev server, giving you HMR and instant module reloading. In <strong>production</strong>, tags reference hashed files from the build manifest.</p>

<h2>The <code>vite()</code> Helper</h2>

<p>The <code>vite()</code> helper function resolves the <code>Vite</code> singleton from the application container. It is the primary way to interact with the Vite integration from your route handlers.</p>

<pre><code class="language-typescript">import { vite } from '@mantiq/vite'

// Get the Vite instance
const v = vite()

// Check mode
v.isDev()          // boolean
v.devServerUrl()   // string

// Generate asset tags
const tags = await v.assets('src/main.tsx')

// Render a full page
const html = await v.page({ entry: 'src/main.tsx', title: 'Home' })</code></pre>

<h2>Asset Generation</h2>

<p>The <code>assets()</code> method generates the appropriate <code>&lt;script&gt;</code> and <code>&lt;link&gt;</code> tags for your entrypoint(s). It handles everything differently based on the current mode.</p>

<pre><code class="language-typescript">// Single entrypoint
const tags = await vite().assets('src/main.tsx')

// Multiple entrypoints
const tags = await vite().assets(['src/main.tsx', 'src/style.css'])</code></pre>

<h3>Dev Mode Output</h3>

<p>In development, <code>assets()</code> generates tags pointing to the Vite dev server:</p>

<pre><code class="language-html">&lt;!-- React Fast Refresh preamble (if reactRefresh: true) --&gt;
&lt;script type="module"&gt;
  import RefreshRuntime from 'http://localhost:5173/@react-refresh'
  // ... refresh setup
&lt;/script&gt;

&lt;!-- Vite HMR client --&gt;
&lt;script type="module" src="http://localhost:5173/@vite/client"&gt;&lt;/script&gt;

&lt;!-- Your entrypoint --&gt;
&lt;script type="module" src="http://localhost:5173/src/main.tsx"&gt;&lt;/script&gt;</code></pre>

<h3>Production Output</h3>

<p>In production, <code>assets()</code> reads the Vite manifest to resolve hashed filenames, includes CSS extracted from your modules, and adds <code>modulepreload</code> hints for statically imported chunks:</p>

<pre><code class="language-html">&lt;link rel="stylesheet" href="/build/assets/main-a1b2c3.css"&gt;
&lt;link rel="modulepreload" href="/build/assets/vendor-d4e5f6.js"&gt;
&lt;script type="module" src="/build/assets/main-g7h8i9.js"&gt;&lt;/script&gt;</code></pre>

<h2>Full Page Rendering</h2>

<p>The <code>page()</code> method renders a complete HTML document with your assets, page data, and optional SSR content injected.</p>

<pre><code class="language-typescript">const html = await vite().page({
  entry: 'src/main.tsx',
  title: 'Dashboard',
  data: { user: { name: 'Alice' } },
  head: '&lt;meta name="description" content="User dashboard"&gt;',
})

return new Response(html, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
})</code></pre>

<p>This produces a document like:</p>

<pre><code class="language-html">&lt;!DOCTYPE html&gt;
&lt;html lang="en"&gt;
&lt;head&gt;
    &lt;meta charset="UTF-8"&gt;
    &lt;meta name="viewport" content="width=device-width, initial-scale=1.0"&gt;
    &lt;title&gt;Dashboard&lt;/title&gt;
    &lt;meta name="description" content="User dashboard"&gt;
    &lt;!-- asset tags here --&gt;
&lt;/head&gt;
&lt;body&gt;
    &lt;div id="app"&gt;&lt;!-- SSR content if enabled --&gt;&lt;/div&gt;
    &lt;script&gt;window.__MANTIQ_DATA__ = {"user":{"name":"Alice"}}&lt;/script&gt;
&lt;/body&gt;
&lt;/html&gt;</code></pre>

<p>Page data is serialised to <code>window.__MANTIQ_DATA__</code>, making it available to your frontend framework on the client side.</p>

<h2>The <code>render()</code> Method</h2>

<p>For single-page app style navigation, <code>render()</code> implements the MantiqJS protocol. It returns either JSON (for client-side navigation) or a full HTML page (for first loads), based on the <code>X-Mantiq</code> request header.</p>

<pre><code class="language-typescript">router.get('/dashboard', async (request) =&gt; {
  return vite().render(request, {
    page: 'Dashboard',
    entry: ['src/style.css', 'src/main.tsx'],
    data: { users: await User.all() },
    title: 'Dashboard',
  })
})</code></pre>

<p>When the client sends <code>X-Mantiq: true</code>, the response is JSON containing the page data. Otherwise, it renders a full HTML page using <code>page()</code> internally.</p>

<h2>Vite Config (<code>vite.config.ts</code>)</h2>

<p>Your project-level <code>vite.config.ts</code> configures Vite itself. Here is a typical setup for a React project with Tailwind CSS:</p>

<pre><code class="language-typescript">// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: false,
  build: {
    outDir: 'public/build',
    manifest: true,
    emptyOutDir: true,
    rollupOptions: {
      input: ['src/main.tsx', 'src/style.css'],
    },
  },
})</code></pre>

<p>Set <code>publicDir: false</code> to prevent Vite from copying files from the public directory during build &mdash; MantiqJS serves static files through its own middleware. Also ensure <code>manifest: true</code> is set so the production manifest is generated.</p>

<h3>Key Settings</h3>

<ul>
  <li><code>build.outDir</code> must match <code>publicDir/buildDir</code> from your MantiqJS vite config (e.g. <code>public/build</code>).</li>
  <li><code>build.manifest: true</code> generates the <code>.vite/manifest.json</code> file that MantiqJS reads in production.</li>
  <li><code>rollupOptions.input</code> lists your entrypoints &mdash; these are the same paths you pass to <code>assets()</code> or <code>page()</code>.</li>
</ul>

<h2>Production Build</h2>

<p>To build your frontend assets for production:</p>

<pre><code class="language-bash"># Build client assets
npx vite build

# Build SSR bundle (if using SSR)
npx vite build --ssr src/ssr.tsx --outDir bootstrap/ssr</code></pre>

<p>After building, the manifest at <code>public/build/.vite/manifest.json</code> maps your source entrypoints to their hashed output files. MantiqJS reads this manifest automatically in production.</p>

<p>If you deploy without running <code>vite build</code>, asset tag generation will throw a <code>ViteManifestNotFoundError</code> in production mode.</p>
`
}
