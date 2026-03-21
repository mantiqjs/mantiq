export default {
  title: 'Database: Getting Started',
  content: `
<h2>Introduction</h2>

<p>The <code>@mantiq/database</code> package provides a complete data layer for MantiqJS applications. It includes a fluent query builder, schema builder, migrations, an Active Record ORM, seeders, and factories. Multiple database drivers are supported out of the box.</p>

<h3>Supported Drivers</h3>

<table>
  <thead>
    <tr><th>Driver</th><th>Package</th><th>Notes</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>SQLite</strong></td><td>Built-in (<code>bun:sqlite</code>)</td><td>Zero-dependency. Perfect for development and single-server deployments.</td></tr>
    <tr><td><strong>PostgreSQL</strong></td><td><code>pg</code></td><td>Full-featured. Recommended for production applications.</td></tr>
    <tr><td><strong>MySQL</strong></td><td><code>mysql2</code></td><td>Widely supported. Compatible with MariaDB.</td></tr>
    <tr><td><strong>MongoDB</strong></td><td><code>mongodb</code></td><td>Document database support via a separate <code>mongo()</code> connection method.</td></tr>
  </tbody>
</table>

<h2>Installation</h2>

<p>The database package is included in MantiqJS starter kits. To add it to an existing project:</p>

<pre><code class="language-bash">bun add @mantiq/database

# Install the driver for your database (SQLite is built-in)
bun add pg          # PostgreSQL
bun add mysql2      # MySQL / MariaDB
bun add mongodb     # MongoDB</code></pre>

<h2>Configuration</h2>

<p>Database connections are configured in <code>config/database.ts</code>. You can define multiple connections and specify a default.</p>

<pre><code class="language-typescript">// config/database.ts
import { env } from '@mantiq/core'

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
      user: env('DB_USERNAME', 'root'),
      password: env('DB_PASSWORD', ''),
    },

    mysql: {
      driver: 'mysql' as const,
      host: env('DB_HOST', '127.0.0.1'),
      port: Number(env('DB_PORT', '3306')),
      database: env('DB_DATABASE', 'mantiq'),
      user: env('DB_USERNAME', 'root'),
      password: env('DB_PASSWORD', ''),
    },
  },
}</code></pre>

<p>Environment variables are read using the <code>env()</code> helper from <code>@mantiq/core</code>, which reads from <code>.env</code> files. Set your credentials in the <code>.env</code> file at the project root.</p>

<h3>.env Example</h3>

<pre><code class="language-bash">DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite

# Or for PostgreSQL:
# DB_CONNECTION=postgres
# DB_HOST=127.0.0.1
# DB_PORT=5432
# DB_DATABASE=myapp
# DB_USERNAME=postgres
# DB_PASSWORD=secret</code></pre>

<h2>Service Provider</h2>

<p>Register the <code>DatabaseServiceProvider</code> (or create one) to bind the <code>DatabaseManager</code> in the application container. Here is a typical setup:</p>

<pre><code class="language-typescript">import { ServiceProvider } from '@mantiq/core'
import { DatabaseManager, Model } from '@mantiq/database'

export class DatabaseServiceProvider extends ServiceProvider {
  override register(): void {
    this.app.singleton(DatabaseManager, () =&gt; {
      const config = this.app.make('config').get('database')
      const manager = new DatabaseManager(config)

      // Set the default connection for models
      Model.setConnection(manager.connection())

      return manager
    })
  }
}</code></pre>

<p>The <code>@mantiq/database</code> package also exports a <code>createDatabaseManager()</code> factory function and a <code>setupModels()</code> helper if you prefer to set things up without a service provider:</p>

<pre><code class="language-typescript">import { createDatabaseManager, setupModels } from '@mantiq/database'

const manager = createDatabaseManager({
  default: 'sqlite',
  connections: {
    sqlite: { driver: 'sqlite', database: 'database/database.sqlite' },
  },
})

setupModels(manager)</code></pre>

<h2>The DatabaseManager</h2>

<p>The <code>DatabaseManager</code> manages all database connections. It lazily creates connections on first use and caches them for subsequent calls.</p>

<pre><code class="language-typescript">import { DatabaseManager } from '@mantiq/database'

// Get the default connection
const connection = manager.connection()

// Get a named connection
const pgConnection = manager.connection('postgres')

// Shorthand: query a table on the default connection
const users = await manager.table('users').get()

// Shorthand: access the schema builder
await manager.schema().create('posts', (t) =&gt; {
  t.id()
  t.string('title')
  t.timestamps()
})</code></pre>

<h2>The <code>db()</code> Helper</h2>

<p>The <code>db()</code> helper function provides convenient access to database connections from anywhere in your application. It resolves the <code>DatabaseManager</code> from the application container.</p>

<pre><code class="language-typescript">import { db } from '@mantiq/database'

// Use the default connection
const users = await db().table('users').where('active', true).get()

// Use a named connection
const logs = await db('postgres').table('audit_logs').get()</code></pre>

<h2>Running Raw Queries</h2>

<p>Every connection provides methods for executing raw SQL:</p>

<pre><code class="language-typescript">const connection = db()

// SELECT queries — returns an array of row objects
const users = await connection.select(
  'SELECT * FROM users WHERE active = ?',
  [true]
)

// INSERT/UPDATE/DELETE — returns the number of affected rows
const affected = await connection.statement(
  'UPDATE users SET active = ? WHERE last_login &lt; ?',
  [false, '2025-01-01']
)

// INSERT and get the new row's ID
const id = await connection.insertGetId(
  'INSERT INTO users (name, email) VALUES (?, ?)',
  ['Alice', 'alice@example.com']
)</code></pre>

<p>Always use parameterised bindings (<code>?</code> placeholders) instead of string interpolation. The database driver handles escaping, preventing SQL injection.</p>

<h2>Transactions</h2>

<p>Wrap multiple queries in a transaction to ensure they all succeed or all fail together:</p>

<pre><code class="language-typescript">const result = await db().transaction(async (trx) =&gt; {
  await trx.table('accounts').where('id', 1).update({
    balance: db().raw('balance - 100')
  })

  await trx.table('accounts').where('id', 2).update({
    balance: db().raw('balance + 100')
  })

  return { transferred: 100 }
})</code></pre>

<p>If the callback throws an error, the transaction is automatically rolled back. If it completes successfully, the transaction is committed.</p>

<h2>Connection Methods</h2>

<p>Each database connection implements the <code>DatabaseConnection</code> interface:</p>

<table>
  <thead>
    <tr><th>Method</th><th>Description</th></tr>
  </thead>
  <tbody>
    <tr><td><code>select(sql, bindings?)</code></td><td>Execute a SELECT query, returns array of row objects.</td></tr>
    <tr><td><code>statement(sql, bindings?)</code></td><td>Execute INSERT/UPDATE/DELETE, returns rows affected.</td></tr>
    <tr><td><code>insertGetId(sql, bindings?)</code></td><td>Execute an INSERT and return the new row's ID.</td></tr>
    <tr><td><code>transaction(callback)</code></td><td>Run a callback inside a database transaction.</td></tr>
    <tr><td><code>table(name)</code></td><td>Start a query builder for the given table.</td></tr>
    <tr><td><code>schema()</code></td><td>Access the schema builder for DDL operations.</td></tr>
    <tr><td><code>getDriverName()</code></td><td>Returns the driver name (<code>'sqlite'</code>, <code>'postgres'</code>, <code>'mysql'</code>).</td></tr>
  </tbody>
</table>

<h2>MongoDB Connections</h2>

<p>MongoDB connections use a separate <code>mongo()</code> method on the <code>DatabaseManager</code>, since MongoDB is not a SQL database and has a different query interface.</p>

<pre><code class="language-typescript">// config/database.ts
export default {
  default: 'sqlite',
  connections: {
    // ... SQL connections
    mongodb: {
      driver: 'mongodb' as const,
      uri: env('MONGO_URI', 'mongodb://localhost:27017'),
      database: env('MONGO_DATABASE', 'mantiq'),
    },
  },
}

// Usage
const mongo = manager.mongo('mongodb')
const docs = await mongo.collection('users').find({ active: true })</code></pre>

<h2>Error Handling</h2>

<p>The database package provides typed errors for common failure scenarios:</p>

<ul>
  <li><code>ConnectionError</code> &mdash; Thrown when a connection cannot be established or a named connection is not configured.</li>
  <li><code>QueryError</code> &mdash; Thrown when a SQL query fails. Includes the SQL string and bindings for debugging.</li>
  <li><code>ModelNotFoundError</code> &mdash; Thrown by <code>firstOrFail()</code> and <code>findOrFail()</code> when no matching row is found.</li>
</ul>

<pre><code class="language-typescript">import { QueryError, ConnectionError } from '@mantiq/database'

try {
  await db().table('users').insert({ email: 'duplicate@test.com' })
} catch (err) {
  if (err instanceof QueryError) {
    console.error('SQL:', err.sql)
    console.error('Bindings:', err.bindings)
    console.error('Cause:', err.originalError.message)
  }
}</code></pre>

<p>Never log raw SQL queries containing user data in production. The <code>QueryError</code> includes bindings for debugging, but these may contain sensitive information.</p>
`
}
