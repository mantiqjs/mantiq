export default {
  title: 'Migrations',
  content: `
<h2>Introduction</h2>

<p>Migrations are version-controlled database schema changes. Instead of manually modifying your database, you write migration files that describe the changes, then run them with a single command. This ensures your database schema is consistent across development, staging, and production environments, and that every team member is working with the same schema.</p>

<p>Each migration has an <code>up()</code> method (to apply the change) and a <code>down()</code> method (to reverse it). MantiqJS tracks which migrations have been run in a <code>migrations</code> table.</p>

<h2>Creating Migrations</h2>

<p>Generate a new migration file using the CLI:</p>

<pre><code class="language-bash">bun mantiq make:migration create_posts_table</code></pre>

<p>This creates a timestamped file in the <code>database/migrations/</code> directory:</p>

<pre><code class="language-text">database/migrations/
  2026_03_18_000001_create_users_table.ts
  2026_03_18_000002_create_posts_table.ts</code></pre>

<p>The timestamp prefix ensures migrations run in the order they were created.</p>

<h2>Migration Structure</h2>

<p>A migration extends the abstract <code>Migration</code> class and implements <code>up()</code> and <code>down()</code> methods. Both receive a <code>SchemaBuilder</code> and the raw <code>DatabaseConnection</code>.</p>

<pre><code class="language-typescript">import { Migration } from '@mantiq/database'
import type { SchemaBuilder } from '@mantiq/database'
import type { DatabaseConnection } from '@mantiq/database'

export default class CreatePostsTable extends Migration {
  override async up(schema: SchemaBuilder, db: DatabaseConnection): Promise&lt;void&gt; {
    await schema.create('posts', (t) =&gt; {
      t.id()
      t.string('title')
      t.text('body')
      t.integer('user_id')
      t.boolean('published').default(false)
      t.timestamps()
    })
  }

  override async down(schema: SchemaBuilder, db: DatabaseConnection): Promise&lt;void&gt; {
    await schema.dropIfExists('posts')
  }
}</code></pre>

<p>The <code>down()</code> method should reverse what <code>up()</code> does. For a <code>create</code> migration, the down method should <code>drop</code> the table so rollbacks work cleanly.</p>

<h2>SchemaBuilder Methods</h2>

<p>The <code>SchemaBuilder</code> provides methods for creating, altering, and dropping tables.</p>

<h3>Creating Tables</h3>

<pre><code class="language-typescript">await schema.create('users', (t) =&gt; {
  t.id()
  t.string('name')
  t.string('email').unique()
  t.string('password')
  t.boolean('is_active').default(true)
  t.timestamps()
})</code></pre>

<h3>Modifying Tables</h3>

<pre><code class="language-typescript">await schema.table('users', (t) =&gt; {
  t.string('phone').nullable()
  t.text('bio').nullable()
})</code></pre>

<h3>Dropping Tables</h3>

<pre><code class="language-typescript">// Drop if it exists (safe)
await schema.dropIfExists('posts')

// Drop (throws if table does not exist)
await schema.drop('posts')</code></pre>

<h3>Other Schema Operations</h3>

<pre><code class="language-typescript">// Check if a table exists
const exists = await schema.hasTable('users')

// Check if a column exists
const hasEmail = await schema.hasColumn('users', 'email')

// Rename a table
await schema.rename('posts', 'articles')

// Disable/enable foreign key constraints
await schema.disableForeignKeyConstraints()
await schema.enableForeignKeyConstraints()</code></pre>

<h2>Blueprint Column Types</h2>

<p>The callback passed to <code>schema.create()</code> and <code>schema.table()</code> receives a <code>Blueprint</code> instance. Use it to define columns.</p>

<h3>Primary Keys</h3>

<pre><code class="language-typescript">t.id()              // Auto-incrementing BIGINT primary key named 'id'
t.id('post_id')     // Custom name
t.uuid('id')        // UUID primary key</code></pre>

<h3>Strings</h3>

<pre><code class="language-typescript">t.string('name')           // VARCHAR(255)
t.string('code', 10)       // VARCHAR(10)
t.text('body')             // TEXT
t.mediumText('content')    // MEDIUMTEXT (MySQL) / TEXT (others)
t.longText('data')         // LONGTEXT (MySQL) / TEXT (others)</code></pre>

<h3>Numbers</h3>

<pre><code class="language-typescript">t.integer('age')
t.bigInteger('population')
t.tinyInteger('priority')
t.smallInteger('rank')
t.unsignedInteger('count')
t.unsignedBigInteger('views')
t.float('latitude', 8, 2)
t.double('amount', 15, 8)
t.decimal('price', 8, 2)</code></pre>

<h3>Boolean</h3>

<pre><code class="language-typescript">t.boolean('active')         // TINYINT(1) on MySQL, BOOLEAN on Postgres</code></pre>

<h3>Date &amp; Time</h3>

<pre><code class="language-typescript">t.date('birth_date')
t.dateTime('published_at')
t.timestamp('verified_at')
t.timestamps()              // Adds created_at + updated_at (nullable timestamps)
t.softDeletes()             // Adds deleted_at (nullable timestamp)</code></pre>

<h3>JSON</h3>

<pre><code class="language-typescript">t.json('metadata')          // JSON (TEXT on SQLite)
t.jsonb('settings')         // JSONB on Postgres, JSON on MySQL</code></pre>

<h3>Other Types</h3>

<pre><code class="language-typescript">t.uuid('external_id')                    // UUID / VARCHAR(36)
t.binary('data')                          // BLOB / BYTEA
t.enum('status', ['draft', 'published'])  // ENUM on MySQL, TEXT + CHECK on Postgres</code></pre>

<h2>Column Modifiers</h2>

<p>Column methods return a <code>ColumnDefinition</code> that supports fluent modifiers:</p>

<pre><code class="language-typescript">await schema.create('posts', (t) =&gt; {
  t.id()
  t.string('title')
  t.text('excerpt').nullable()
  t.string('slug').unique()
  t.boolean('published').default(false)
  t.integer('sort_order').index()
  t.integer('views').unsigned().default(0)
  t.timestamps()
})</code></pre>

<h3>Available Modifiers</h3>

<table>
  <thead>
    <tr><th>Modifier</th><th>Description</th></tr>
  </thead>
  <tbody>
    <tr><td><code>.nullable()</code></td><td>Allow NULL values (columns are NOT NULL by default).</td></tr>
    <tr><td><code>.default(value)</code></td><td>Set a default value. Accepts strings, numbers, booleans, or <code>null</code>.</td></tr>
    <tr><td><code>.unique()</code></td><td>Create a unique index on this column.</td></tr>
    <tr><td><code>.index()</code></td><td>Create a regular index on this column.</td></tr>
    <tr><td><code>.unsigned()</code></td><td>Mark the column as unsigned (MySQL only).</td></tr>
    <tr><td><code>.after(column)</code></td><td>Place this column after another (MySQL only).</td></tr>
    <tr><td><code>.comment(text)</code></td><td>Add a comment to the column definition.</td></tr>
  </tbody>
</table>

<h2>Indexes</h2>

<p>In addition to column-level <code>.unique()</code> and <code>.index()</code>, you can create composite indexes:</p>

<pre><code class="language-typescript">await schema.create('posts', (t) =&gt; {
  t.id()
  t.integer('user_id')
  t.string('status')
  t.timestamps()

  // Composite index
  t.index(['user_id', 'status'])

  // Composite unique index
  t.unique(['user_id', 'status'], 'user_status_unique')

  // Composite primary key
  t.primary(['user_id', 'post_id'])
})</code></pre>

<h2>Foreign Keys</h2>

<pre><code class="language-typescript">await schema.create('posts', (t) =&gt; {
  t.id()
  t.unsignedBigInteger('user_id')
  t.string('title')
  t.timestamps()

  // Define the foreign key constraint
  t.foreign('user_id').references('id').on('users')
})

// With cascade options
await schema.create('comments', (t) =&gt; {
  t.id()
  t.unsignedBigInteger('post_id')
  t.text('body')
  t.timestamps()

  const fk = t.foreign('post_id').references('id').on('posts')
  fk.onDelete = 'cascade'
  fk.onUpdate = 'cascade'
})</code></pre>

<h3>Foreign ID Shorthand</h3>

<pre><code class="language-typescript">// Creates an unsigned big integer column
t.foreignId('user_id')
// Then define the foreign key separately:
t.foreign('user_id').references('id').on('users')</code></pre>

<h2>Altering Tables</h2>

<p>Use <code>schema.table()</code> to modify an existing table. You can add new columns or drop existing ones.</p>

<pre><code class="language-typescript">// Add columns
await schema.table('users', (t) =&gt; {
  t.string('phone').nullable()
  t.text('address').nullable()
})

// Drop columns
await schema.table('users', (t) =&gt; {
  t.dropColumn('phone')
})

// Drop timestamps
await schema.table('posts', (t) =&gt; {
  t.dropTimestamps()
})</code></pre>

<h2>Running Migrations</h2>

<h3>Running All Pending Migrations</h3>

<pre><code class="language-bash">bun mantiq migrate</code></pre>

<p>This runs all migration files in <code>database/migrations/</code> that have not yet been applied. Each batch of migrations gets a batch number in the <code>migrations</code> tracking table.</p>

<h3>Rolling Back</h3>

<pre><code class="language-bash"># Roll back the last batch of migrations
bun mantiq migrate:rollback</code></pre>

<h3>Reset (Roll Back All)</h3>

<pre><code class="language-bash"># Roll back all migrations in reverse order
bun mantiq migrate:reset</code></pre>

<h3>Fresh (Drop All + Re-Migrate)</h3>

<pre><code class="language-bash"># Drop all tables and re-run all migrations from scratch
bun mantiq migrate:fresh</code></pre>

<p><code>migrate:fresh</code> drops <em>all</em> tables in the database, not just those managed by migrations. Use it only in development &mdash; never run it in production.</p>

<h3>Migration Status</h3>

<pre><code class="language-bash">bun mantiq migrate:status</code></pre>

<p>Shows which migrations have been run, their batch number, and which are still pending.</p>

<h2>Programmatic Usage</h2>

<p>You can also run migrations programmatically using the <code>Migrator</code> class:</p>

<pre><code class="language-typescript">import { Migrator } from '@mantiq/database'

const migrator = new Migrator(connection, {
  migrationsPath: 'database/migrations',
})

// Run pending migrations
const ran = await migrator.run()
console.log('Ran:', ran)

// Roll back the last batch
const rolled = await migrator.rollback()

// Check status
const status = await migrator.status()
for (const m of status) {
  console.log(m.name, m.ran ? 'Ran' : 'Pending', 'Batch:', m.batch)
}

// Drop all and re-run
await migrator.fresh()</code></pre>

<h2>Migration Tracking</h2>

<p>MantiqJS tracks migration state in a <code>migrations</code> table that is created automatically on first run:</p>

<pre><code class="language-sql">CREATE TABLE migrations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  migration TEXT NOT NULL,
  batch     INTEGER NOT NULL
)</code></pre>

<p>Each time you run <code>migrate</code>, the batch number increments. Rolling back undoes the last batch, allowing you to roll back groups of related migrations together.</p>

<h2>Best Practices</h2>

<ul>
  <li><strong>Never edit a migration after it has been run</strong> in a shared environment. Create a new migration instead.</li>
  <li><strong>Always write a <code>down()</code> method</strong> so migrations can be rolled back cleanly.</li>
  <li><strong>Use descriptive names</strong> like <code>create_posts_table</code>, <code>add_phone_to_users</code>, <code>create_role_user_pivot</code>.</li>
  <li><strong>Keep migrations small</strong> &mdash; one migration per logical change.</li>
  <li><strong>Use foreign key constraints</strong> to maintain data integrity, but disable them during <code>fresh</code> operations.</li>
</ul>

<p>For SQLite in development, <code>migrate:fresh</code> is the fastest way to reset your database &mdash; it drops everything and replays all migrations, which is much faster than rolling back one by one.</p>
`
}
