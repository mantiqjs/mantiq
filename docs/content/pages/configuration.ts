export default {
  title: 'Configuration',
  content: `
<h2>Overview</h2>

<p>
  MantiqJS configuration lives in the <code>config/</code> directory as TypeScript files.
  Each file exports a default object, and the filename becomes the top-level configuration
  key. This approach gives you full type safety, the ability to compute values at startup,
  and IDE autocompletion in your config files.
</p>

<p>
  Configuration is loaded once during application bootstrap &mdash; before any service provider
  runs &mdash; and is then available everywhere in your application via the <code>config()</code>
  helper or the <code>ConfigRepository</code> class.
</p>

<h2>Configuration Files</h2>

<p>
  A typical MantiqJS application has the following config files:
</p>

<pre><code class="language-bash">config/
  app.ts          # Application name, env, debug, key, URL, port
  auth.ts         # Authentication guards and user providers
  database.ts     # Database connections
  vite.ts         # Vite entry points and build settings</code></pre>

<p>
  Here is a complete example of <code>config/app.ts</code>:
</p>

<pre><code class="language-typescript">import { env } from '@mantiq/core'

export default {
  name: env('APP_NAME', 'MantiqJS'),
  env: env('APP_ENV', 'production'),
  debug: env('APP_DEBUG', false),
  key: env('APP_KEY', ''),
  url: env('APP_URL', 'http://localhost:3000'),
  port: Number(env('APP_PORT', '3000')),
}</code></pre>

<p>
  And <code>config/database.ts</code>:
</p>

<pre><code class="language-typescript">import { env } from '@mantiq/core'

export default {
  default: env('DB_CONNECTION', 'sqlite'),

  connections: {
    sqlite: {
      driver: 'sqlite' as const,
      database: env('DB_DATABASE', 'database/database.sqlite'),
    },

    postgres: {
      driver: 'postgres' as const,
      host: env('DB_HOST', '127.0.0.1'),
      port: Number(env('DB_PORT', '5432')),
      database: env('DB_DATABASE', 'mantiq'),
      username: env('DB_USERNAME', 'root'),
      password: env('DB_PASSWORD', ''),
    },
  },
}</code></pre>

<h2>Accessing Configuration Values</h2>

<h3>The config() Helper</h3>

<p>
  Use the global <code>config()</code> helper to read configuration values from anywhere in
  your application. It accepts a dot-notation key that starts with the filename, followed
  by the path into the exported object:
</p>

<pre><code class="language-typescript">import { config } from '@mantiq/core'

// config/app.ts -&gt; { name: 'MantiqJS' }
const appName = config('app.name')
// 'MantiqJS'

// config/database.ts -&gt; { connections: { sqlite: { driver: 'sqlite' } } }
const dbDriver = config('database.connections.sqlite.driver')
// 'sqlite'

// config/database.ts -&gt; { default: 'sqlite' }
const defaultConnection = config('database.default')
// 'sqlite'</code></pre>

<h3>Default Values</h3>

<p>
  Pass a second argument as a fallback if the key does not exist:
</p>

<pre><code class="language-typescript">const timezone = config('app.timezone', 'UTC')
// 'UTC' (if app.timezone is not defined)

const cacheDriver = config('cache.default', 'memory')
// 'memory' (if cache config doesn't exist)</code></pre>

<p>
  If the key does not exist and no default is provided, a <code>ConfigKeyNotFoundError</code>
  is thrown. Always provide a default value for optional configuration keys.
</p>

<h3>Type Narrowing</h3>

<p>
  The <code>config()</code> helper accepts a generic type parameter:
</p>

<pre><code class="language-typescript">const port = config&lt;number&gt;('app.port', 3000)
// TypeScript knows this is a number

const debug = config&lt;boolean&gt;('app.debug', false)
// TypeScript knows this is a boolean</code></pre>

<h3>Checking and Setting Values</h3>

<p>
  You can also check for existence and set values at runtime through the
  <code>ConfigRepository</code>:
</p>

<pre><code class="language-typescript">import { app } from '@mantiq/core'
import { ConfigRepository } from '@mantiq/core'

const configRepo = app(ConfigRepository)

// Check if a key exists
configRepo.has('app.name')     // true
configRepo.has('app.missing')  // false

// Set a value at runtime
configRepo.set('app.name', 'New Name')

// Get all configuration
const all = configRepo.all()   // { app: { ... }, database: { ... }, ... }</code></pre>

<div class="warning">
  <strong>Warning:</strong> Setting configuration values at runtime affects the current process
  only. The changes are not persisted to disk. This is useful for testing or temporary overrides.
</div>

<h2>Environment Variables</h2>

<h3>The .env File</h3>

<p>
  MantiqJS reads environment variables from a <code>.env</code> file in your project root.
  This file should contain key-value pairs, one per line:
</p>

<pre><code class="language-bash">APP_NAME=MantiqJS
APP_ENV=local
APP_DEBUG=true
APP_KEY=base64:K7v2H8qJ5mN9pR3sT6wX1zA4cE7fI0jL2nO5rU8xB1d=
APP_URL=http://localhost:3000
APP_PORT=3000

DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite

# Comments start with #
# Blank lines are ignored</code></pre>

<div class="warning">
  <strong>Warning:</strong> Never commit your <code>.env</code> file to version control. It
  contains sensitive values like your <code>APP_KEY</code> and database credentials. Commit a
  <code>.env.example</code> file instead, with placeholder values.
</div>

<h3>The env() Helper</h3>

<p>
  The <code>env()</code> helper reads environment variables with automatic type coercion:
</p>

<pre><code class="language-typescript">import { env } from '@mantiq/core'

// String values (default)
env('APP_NAME')                    // 'MantiqJS'
env('APP_NAME', 'Default')        // 'MantiqJS' (or 'Default' if not set)

// Boolean coercion: 'true' and 'false' strings are converted
env('APP_DEBUG', false)           // true (boolean, not string)

// Undefined if not set and no default
env('MISSING_KEY')                // undefined</code></pre>

<p>
  Type coercion rules:
</p>

<ul>
  <li><code>'true'</code> &rarr; <code>true</code> (boolean)</li>
  <li><code>'false'</code> &rarr; <code>false</code> (boolean)</li>
  <li><code>''</code> (empty string) &rarr; <code>''</code> (empty string, not undefined)</li>
  <li><code>undefined</code> (not set) &rarr; the default value, or <code>undefined</code></li>
  <li>All other values remain as strings</li>
</ul>

<h3>env() in Config Files</h3>

<p>
  The intended pattern is to use <code>env()</code> inside config files, then use
  <code>config()</code> everywhere else. This ensures your application code has a single
  source of truth for configuration:
</p>

<pre><code class="language-typescript">// config/app.ts
import { env } from '@mantiq/core'

export default {
  debug: env('APP_DEBUG', false),  // Read from env here
}

// In your application code
import { config } from '@mantiq/core'

if (config('app.debug')) {         // Read from config everywhere else
  console.log('Debug mode is on')
}</code></pre>

<div class="note">
  <strong>Best practice:</strong> Avoid calling <code>env()</code> directly in application code.
  Config files are the bridge between environment variables and your application. This makes it
  easy to see all configuration in one place and to provide sensible defaults.
</div>

<h2>How Config Loading Works</h2>

<p>
  When you call <code>Application.create(basePath, 'config')</code>, the following happens:
</p>

<ol>
  <li>
    <strong>Cache check.</strong> MantiqJS looks for a cached config file at
    <code>bootstrap/cache/config.json</code>. If found, the cached config is used directly
    &mdash; no config files are loaded from disk. This is a production optimization.
  </li>
  <li>
    <strong>Directory scan.</strong> If no cache exists, MantiqJS scans the <code>config/</code>
    directory for <code>*.ts</code> files using <code>Bun.Glob</code>.
  </li>
  <li>
    <strong>Dynamic import.</strong> Each config file is imported and its default export is
    stored under a key matching the filename (without extension).
  </li>
  <li>
    <strong>Container registration.</strong> The resulting <code>ConfigRepository</code> is
    registered as an instance in the service container, making it available to all service
    providers and application code.
  </li>
</ol>

<p>
  Because config is loaded before any service provider runs, you can safely use
  <code>config()</code> in your provider&rsquo;s <code>register()</code> and <code>boot()</code>
  methods.
</p>

<h2>Configuration Caching</h2>

<p>
  In production, you can cache all configuration into a single JSON file to avoid loading
  and evaluating multiple TypeScript files on every request:
</p>

<pre><code class="language-bash">bun mantiq config:cache</code></pre>

<p>
  This writes <code>bootstrap/cache/config.json</code>. When this file exists,
  <code>Application.create()</code> loads config from it instead of scanning the
  <code>config/</code> directory.
</p>

<p>
  To clear the cache:
</p>

<pre><code class="language-bash">bun mantiq config:clear</code></pre>

<div class="warning">
  <strong>Warning:</strong> When config is cached, changes to your <code>.env</code> or
  <code>config/*.ts</code> files will not take effect until you clear and rebuild the cache.
  Do not use config caching during development.
</div>

<h2>Creating Custom Config Files</h2>

<p>
  You can add any number of custom config files. Simply create a new <code>.ts</code> file in
  the <code>config/</code> directory:
</p>

<pre><code class="language-typescript">// config/mail.ts
import { env } from '@mantiq/core'

export default {
  default: env('MAIL_DRIVER', 'smtp'),

  from: {
    address: env('MAIL_FROM_ADDRESS', 'hello@example.com'),
    name: env('MAIL_FROM_NAME', 'MantiqJS'),
  },

  drivers: {
    smtp: {
      host: env('MAIL_HOST', 'smtp.mailgun.org'),
      port: Number(env('MAIL_PORT', '587')),
      username: env('MAIL_USERNAME', ''),
      password: env('MAIL_PASSWORD', ''),
    },
  },
}</code></pre>

<p>
  Access it with the <code>config()</code> helper using the filename as the top-level key:
</p>

<pre><code class="language-typescript">config('mail.default')              // 'smtp'
config('mail.from.address')         // 'hello@example.com'
config('mail.drivers.smtp.host')    // 'smtp.mailgun.org'</code></pre>
`
}
