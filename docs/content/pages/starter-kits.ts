export default {
  title: 'Starter Kits',
  content: `
<h2>Introduction</h2>

<p>MantiqJS starter kits provide fully configured project scaffolds with a frontend framework, SSR, Tailwind CSS, authentication pages, and a ready-to-use project structure. Instead of wiring up Vite, React, routing, and SSR yourself, a starter kit gives you a working application in seconds.</p>

<p>Available kits:</p>

<ul>
  <li><strong>React</strong> &mdash; React 19 with React DOM, Tailwind CSS, and SSR support.</li>
  <li><strong>Vue</strong> &mdash; Vue 3 with Vue Router, Tailwind CSS, and SSR support.</li>
  <li><strong>Svelte</strong> &mdash; Svelte 5 with SvelteKit-style SSR and Tailwind CSS.</li>
</ul>

<h2>Installation</h2>

<p>Create a new MantiqJS project with a starter kit using the <code>bun create</code> command:</p>

<pre><code class="language-bash"># React kit (default)
bun create mantiq my-app --kit=react

# Vue kit
bun create mantiq my-app --kit=vue

# Svelte kit
bun create mantiq my-app --kit=svelte</code></pre>

<p>This scaffolds a complete project, installs dependencies, and sets up the database. You can start the dev server immediately:</p>

<pre><code class="language-bash">cd my-app
bun dev</code></pre>

<p>This starts both the Bun backend server and the Vite dev server with HMR. Open <code>http://localhost:3000</code> to see your application.</p>

<h2>Project Structure</h2>

<p>A starter kit project follows the standard MantiqJS directory structure with frontend files in <code>src/</code>:</p>

<pre><code class="language-text">my-app/
├── app/
│   ├── Controllers/
│   ├── Middleware/
│   └── Models/
├── bootstrap/
│   ├── app.ts
│   └── ssr/              # SSR bundle output (after build)
├── config/
│   ├── app.ts
│   ├── database.ts
│   └── vite.ts
├── database/
│   ├── migrations/
│   └── seeders/
├── public/
│   └── build/            # Vite build output (after build)
├── routes/
│   └── web.ts
├── src/                  # Frontend source
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   └── Dashboard.tsx
│   ├── App.tsx
│   ├── pages.ts
│   ├── main.tsx
│   ├── ssr.tsx
│   └── style.css
├── server.ts
├── vite.config.ts
└── package.json</code></pre>

<h2>Page Architecture</h2>

<p>Starter kits use a page-based architecture where each page is a standalone component. The server tells the client which page to render via the MantiqJS protocol.</p>

<h3>Page Components</h3>

<p>Each page lives in <code>src/pages/</code> as a regular component. Page components receive the server-provided data as props, plus a <code>navigate</code> function for client-side navigation.</p>

<pre><code class="language-typescript">// src/pages/Dashboard.tsx
interface DashboardProps {
  users: Array&lt;{ id: number; name: string; email: string }&gt;
  navigate: (href: string) =&gt; void
}

export default function Dashboard({ users, navigate }: DashboardProps) {
  return (
    &lt;div&gt;
      &lt;h1&gt;Dashboard&lt;/h1&gt;
      &lt;ul&gt;
        {users.map(user =&gt; (
          &lt;li key={user.id}&gt;{user.name} ({user.email})&lt;/li&gt;
        ))}
      &lt;/ul&gt;
      &lt;a href="/settings"&gt;Settings&lt;/a&gt;
    &lt;/div&gt;
  )
}</code></pre>

<h3>Page Registry</h3>

<p>The <code>src/pages.ts</code> file exports a map of page names to their components. This registry is used by both the client router and the SSR renderer to resolve page components by name.</p>

<pre><code class="language-typescript">// src/pages.ts
import Login from './pages/Login.tsx'
import Register from './pages/Register.tsx'
import Dashboard from './pages/Dashboard.tsx'

export const pages: Record&lt;string, React.ComponentType&lt;any&gt;&gt; = {
  Login,
  Register,
  Dashboard,
}</code></pre>

<p>When you add a new page, register it here. The key must match the <code>page</code> name passed in <code>vite().render()</code> on the server.</p>

<h3>Server-Side Route</h3>

<p>On the server, routes use <code>vite().render()</code> to serve pages. The <code>page</code> option specifies which component to render:</p>

<pre><code class="language-typescript">// routes/web.ts
import { vite } from '@mantiq/vite'
import { User } from '../app/Models/User.ts'

router.get('/dashboard', async (request) =&gt; {
  const users = await User.all()

  return vite().render(request, {
    page: 'Dashboard',
    entry: ['src/style.css', 'src/main.tsx'],
    data: { users },
    title: 'Dashboard',
  })
})</code></pre>

<h2>The MantiqApp Component</h2>

<p>The <code>MantiqApp</code> component is the root of your frontend application. It manages the current page state, handles client-side navigation, and renders the active page component.</p>

<pre><code class="language-typescript">// src/App.tsx
import { useState, useCallback, useEffect } from 'react'

interface MantiqAppProps {
  pages: Record&lt;string, React.ComponentType&lt;any&gt;&gt;
  initialData?: Record&lt;string, any&gt;
}

export function MantiqApp({ pages, initialData }: MantiqAppProps) {
  const windowData = typeof window !== 'undefined'
    ? (window as any).__MANTIQ_DATA__
    : {}
  const initial = initialData ?? windowData
  const [page, setPage] = useState&lt;string&gt;(initial._page ?? 'Login')
  const [data, setData] = useState&lt;Record&lt;string, any&gt;&gt;(initial)

  const navigate = useCallback(async (href: string) =&gt; {
    const res = await fetch(href, {
      headers: { 'X-Mantiq': 'true', Accept: 'application/json' },
    })
    const newData = await res.json()
    setPage(newData._page)
    setData(newData)
    history.pushState(null, '', newData._url)
  }, [])

  // ... link interception and popstate handling

  const Page = pages[page]
  return Page ? &lt;Page {...data} navigate={navigate} /&gt; : null
}</code></pre>

<h2>Client Navigation Protocol</h2>

<p>MantiqJS implements an Inertia-style client navigation protocol. Instead of full page reloads, clicking internal links triggers a JSON request to the server.</p>

<h3>How It Works</h3>

<ol>
  <li><strong>Link interception:</strong> The <code>MantiqApp</code> component intercepts clicks on internal <code>&lt;a&gt;</code> tags (links starting with <code>/</code> that are not external or modifier-key clicks).</li>
  <li><strong>JSON request:</strong> A fetch request is made with the <code>X-Mantiq: true</code> header. The server detects this and returns JSON instead of HTML.</li>
  <li><strong>Client update:</strong> The response contains <code>_page</code> (the new component name), <code>_url</code> (the new URL), and any page data. The app swaps to the new page component.</li>
  <li><strong>History update:</strong> <code>history.pushState()</code> updates the browser URL without a reload.</li>
</ol>

<pre><code class="language-typescript">// Client sends:
fetch('/dashboard', {
  headers: { 'X-Mantiq': 'true', Accept: 'application/json' }
})

// Server responds with:
{
  "_page": "Dashboard",
  "_url": "/dashboard",
  "users": [{ "id": 1, "name": "Alice" }]
}</code></pre>

<p>This gives you SPA-like navigation with server-driven page rendering. No client-side router is needed &mdash; the server decides which page to show.</p>

<div class="note">
  <strong>Tip:</strong> Standard <code>&lt;a href="/path"&gt;</code> links work automatically. You do not need a special Link component. The <code>MantiqApp</code> intercepts clicks at the document level. Ctrl+click and links with <code>target="_blank"</code> still open normally.
</div>

<h2>Client Entry &amp; Hydration</h2>

<p>The client entry file (<code>src/main.tsx</code>) mounts the app and handles SSR hydration detection:</p>

<pre><code class="language-typescript">// src/main.tsx
import './style.css'
import { hydrateRoot, createRoot } from 'react-dom/client'
import { MantiqApp } from './App.tsx'
import { pages } from './pages.ts'

const root = document.getElementById('app')!
const app = &lt;MantiqApp pages={pages} /&gt;

// Hydrate if SSR content exists, otherwise CSR mount
root.innerHTML.trim()
  ? hydrateRoot(root, app)
  : createRoot(root).render(app)</code></pre>

<p>If the root element contains HTML (from SSR), <code>hydrateRoot</code> attaches event handlers to the existing DOM. If it is empty, <code>createRoot</code> performs a full client-side render. This makes the app work in both SSR and CSR modes.</p>

<h2>SSR Entry</h2>

<p>The SSR entry file renders the same <code>MantiqApp</code> component on the server:</p>

<pre><code class="language-typescript">// src/ssr.tsx
import { renderToString } from 'react-dom/server'
import { MantiqApp } from './App.tsx'
import { pages } from './pages.ts'

export function render(_url: string, data?: Record&lt;string, any&gt;) {
  return {
    html: renderToString(
      &lt;MantiqApp pages={pages} initialData={data} /&gt;
    ),
  }
}</code></pre>

<h2>Adding a New Page</h2>

<p>To add a new page to your starter kit application:</p>

<ol>
  <li>Create the page component in <code>src/pages/</code>.</li>
  <li>Register it in <code>src/pages.ts</code>.</li>
  <li>Add a server route that calls <code>vite().render()</code> with the page name.</li>
</ol>

<pre><code class="language-typescript">// 1. src/pages/Settings.tsx
export default function Settings({ user }: { user: any }) {
  return &lt;h1&gt;Settings for {user.name}&lt;/h1&gt;
}

// 2. src/pages.ts
import Settings from './pages/Settings.tsx'
export const pages = { /* ...existing */, Settings }

// 3. routes/web.ts
router.get('/settings', async (request) =&gt; {
  return vite().render(request, {
    page: 'Settings',
    entry: ['src/style.css', 'src/main.tsx'],
    data: { user: request.auth().user() },
  })
})</code></pre>

<div class="warning">
  <strong>Important:</strong> The page name in <code>vite().render()</code> must exactly match the key in your <code>pages</code> registry. If they do not match, the client will not be able to find the component to render.
</div>

<h2>Building for Production</h2>

<p>Build both the client and SSR bundles before deploying:</p>

<pre><code class="language-bash"># Build client assets + SSR bundle
bun run build

# Or manually:
npx vite build
npx vite build --ssr src/ssr.tsx --outDir bootstrap/ssr

# Start in production
bun start</code></pre>
`
}
