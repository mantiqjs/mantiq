export default {
  title: 'Installation',
  content: `
<h2>Prerequisites</h2>

<p>
  Before creating a MantiqJS project, make sure you have the following installed on your system:
</p>

<ul>
  <li>
    <strong>Bun 1.1.0 or later</strong> &mdash; MantiqJS is built on the Bun runtime and uses
    Bun-specific APIs. Install it from <a href="https://bun.sh">bun.sh</a>:
    <pre><code class="language-bash">curl -fsSL https://bun.sh/install | bash</code></pre>
  </li>
  <li>
    <strong>Node.js 18+ (optional)</strong> &mdash; Not required for running MantiqJS itself,
    but some tooling in the ecosystem (certain Vite plugins, for example) may use Node APIs
    under the hood. Bun provides excellent Node.js compatibility, so this is rarely needed.
  </li>
</ul>

<p>Verify your Bun installation:</p>

<pre><code class="language-bash">bun --version
# Should be 1.1.0 or later</code></pre>

<h2>Creating a New Project</h2>

<p>
  The fastest way to start a new MantiqJS application is with <code>bun create</code>:
</p>

<pre><code class="language-bash">bun create mantiq my-app</code></pre>

<p>
  This scaffolds a complete MantiqJS project in the <code>my-app</code> directory with the
  default configuration, directory structure, example routes, and a SQLite database.
</p>

<h3>Starter Kits</h3>

<p>
  If you want a full-stack application with a frontend framework, use the <code>--kit</code> flag
  to include a starter kit:
</p>

<pre><code class="language-bash"># React + Tailwind CSS + Vite
bun create mantiq my-app --kit=react

# Vue + Tailwind CSS + Vite
bun create mantiq my-app --kit=vue

# Svelte + Tailwind CSS + Vite
bun create mantiq my-app --kit=svelte</code></pre>

<p>
  Starter kits set up a <code>src/</code> directory with your frontend code, configure Vite
  for hot module replacement, and include server-side rendering support. The backend serves
  your frontend pages through the <code>ViteServiceProvider</code>.
</p>

<h3>Additional Flags</h3>

<table>
  <thead>
    <tr>
      <th>Flag</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>--kit=react|vue|svelte</code></td>
      <td>Include a frontend starter kit with Vite integration</td>
    </tr>
    <tr>
      <td><code>--no-git</code></td>
      <td>Skip initializing a git repository</td>
    </tr>
  </tbody>
</table>

<h2>Project Setup</h2>

<p>
  After creating your project, navigate into the directory:
</p>

<pre><code class="language-bash">cd my-app</code></pre>

<h3>Environment Configuration</h3>

<p>
  The scaffolder creates a <code>.env</code> file with sensible defaults. Open it and review
  the settings:
</p>

<pre><code class="language-bash">APP_NAME=MyApp
APP_ENV=local
APP_DEBUG=true
APP_KEY=base64:YOUR_GENERATED_KEY_HERE
APP_URL=http://localhost:3000
APP_PORT=3000

DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite</code></pre>

<p>
  The <code>APP_KEY</code> is automatically generated during project creation. This key is used
  for encrypting cookies and session data. Never commit it to version control or share it publicly.
</p>

<h3>Running Migrations</h3>

<p>
  If your application uses a database, run the migrations to create your tables:
</p>

<pre><code class="language-bash">bun mantiq migrate</code></pre>

<p>
  This executes all migration files in the <code>database/migrations/</code> directory in order.
  MantiqJS tracks which migrations have already run, so you can safely run this command multiple
  times.
</p>

<h3>Seeding the Database</h3>

<p>
  To populate your database with initial data, run the seeder:
</p>

<pre><code class="language-bash">bun mantiq seed</code></pre>

<h2>Starting the Development Server</h2>

<p>
  MantiqJS provides two development commands depending on your setup:
</p>

<h3>Backend Only (API or Server-Rendered)</h3>

<pre><code class="language-bash">bun run dev</code></pre>

<p>
  This starts the Bun HTTP server with hot reloading using <code>--watch</code>. By default,
  the server listens on <code>http://localhost:3000</code>. The port is configurable via
  <code>APP_PORT</code> in your <code>.env</code> file.
</p>

<h3>With Frontend (Starter Kit)</h3>

<p>
  If you are using a starter kit with Vite, you need to run both the backend server and the
  Vite development server:
</p>

<pre><code class="language-bash"># Terminal 1: Start the backend
bun run dev

# Terminal 2: Start the Vite dev server for HMR
bun run dev:frontend</code></pre>

<p>
  The Vite dev server handles hot module replacement for your frontend code. In development,
  MantiqJS proxies asset requests to Vite automatically through the <code>ViteServiceProvider</code>.
  In production, assets are served from the built manifest.
</p>

<h2>Building for Production</h2>

<p>
  When you are ready to deploy, build your frontend assets and start the server in production mode:
</p>

<pre><code class="language-bash"># Build frontend assets (if using a starter kit)
npx vite build

# Start the production server
APP_ENV=production bun run index.ts</code></pre>

<p>
  In production, MantiqJS serves pre-built assets from the Vite manifest file. There is no
  need for the Vite dev server.
</p>

<h2>CLI Overview</h2>

<p>
  MantiqJS includes a CLI tool with 37 built-in commands, accessed through the <code>mantiq.ts</code>
  entry point. The CLI kernel uses auto-discovery, so you do not need to register commands manually.
  Here are the most commonly used commands:
</p>

<pre><code class="language-bash"># Database
bun mantiq migrate              # Run pending migrations
bun mantiq migrate:rollback     # Roll back the last batch of migrations
bun mantiq migrate:fresh        # Drop all tables and re-run all migrations
bun mantiq migrate:status       # Show the status of each migration
bun mantiq seed                 # Run database seeders

# Code generation
bun mantiq make:model User          # Create a new model
bun mantiq make:controller Home     # Create a new controller
bun mantiq make:migration create_posts_table  # Create a migration
bun mantiq make:middleware Auth     # Create a middleware class
bun mantiq make:request StoreUser  # Create a form request
bun mantiq make:seeder UserSeeder  # Create a database seeder
bun mantiq make:factory UserFactory # Create a model factory

# Utilities
bun mantiq route:list           # List all registered routes
bun mantiq serve                # Start the development server
bun mantiq key:generate         # Generate encryption key</code></pre>

<h2>Monorepo Development</h2>

<p>
  If you are contributing to MantiqJS itself or working with the framework source, the project
  uses a monorepo structure with 21 packages managed with Bun workspaces:
</p>

<pre><code class="language-bash">git clone https://github.com/mantiqjs/mantiq.git
cd mantiq
bun install</code></pre>

<p>
  Each package lives in <code>packages/&lt;name&gt;</code> and can be tested independently:
</p>

<pre><code class="language-bash"># Run tests for a specific package
bun test packages/core/

# Run all tests
bun run test</code></pre>

<p>Now that your project is running, read the <a href="/docs/directory-structure">Directory Structure</a> guide to understand what each file and folder does.</p>
`
}
