export default {
  title: 'Query Builder',
  content: `
<h2>Introduction</h2>

<p>The MantiqJS query builder provides a fluent, chainable interface for constructing and executing SQL queries. It works with all supported database drivers (SQLite, PostgreSQL, MySQL) and automatically handles parameterised bindings to prevent SQL injection. All values are passed as bound parameters &mdash; never interpolated into SQL strings.</p>

<pre><code class="language-typescript">import { db } from '@mantiq/database'

const users = await db().table('users')
  .where('active', true)
  .orderBy('name')
  .limit(10)
  .get()</code></pre>

<h2>Getting a Query Builder</h2>

<p>Start a query builder by calling <code>table()</code> on a database connection:</p>

<pre><code class="language-typescript">// Via the db() helper
const query = db().table('users')

// Via a named connection
const query = db('postgres').table('audit_logs')

// Via the DatabaseManager
const query = manager.table('users')</code></pre>

<h2>Selecting</h2>

<h3>Selecting Columns</h3>

<pre><code class="language-typescript">// Select all columns (default)
const users = await db().table('users').get()

// Select specific columns
const users = await db().table('users')
  .select('id', 'name', 'email')
  .get()

// Add columns to an existing selection
const users = await db().table('users')
  .select('id', 'name')
  .addSelect('email')
  .get()</code></pre>

<h3>Raw Selects</h3>

<pre><code class="language-typescript">import { raw } from '@mantiq/database'

const stats = await db().table('orders')
  .selectRaw('COUNT(*) as total, SUM(amount) as revenue')
  .first()

// Using the raw() helper in select
const results = await db().table('orders')
  .select('status', raw('COUNT(*) as count'))
  .groupBy('status')
  .get()</code></pre>

<h3>Distinct Results</h3>

<pre><code class="language-typescript">const cities = await db().table('users')
  .select('city')
  .distinct()
  .get()</code></pre>

<h2>Where Clauses</h2>

<h3>Basic Where</h3>

<p>The <code>where()</code> method accepts a column, an optional operator, and a value. When the operator is omitted, <code>=</code> is assumed.</p>

<pre><code class="language-typescript">// Equality (shorthand)
const users = await db().table('users')
  .where('active', true)
  .get()

// With operator
const users = await db().table('users')
  .where('age', '&gt;', 18)
  .get()

// Multiple where clauses (AND)
const users = await db().table('users')
  .where('active', true)
  .where('role', 'admin')
  .get()</code></pre>

<h3>Or Where</h3>

<pre><code class="language-typescript">const users = await db().table('users')
  .where('role', 'admin')
  .orWhere('role', 'moderator')
  .get()</code></pre>

<h3>Grouped Where (Nested Conditions)</h3>

<p>Pass a callback to <code>where()</code> to create grouped conditions wrapped in parentheses:</p>

<pre><code class="language-typescript">// WHERE active = 1 AND (role = 'admin' OR role = 'moderator')
const users = await db().table('users')
  .where('active', true)
  .where((q) =&gt; {
    q.where('role', 'admin')
     .orWhere('role', 'moderator')
  })
  .get()</code></pre>

<h3>Where In</h3>

<pre><code class="language-typescript">const users = await db().table('users')
  .whereIn('id', [1, 2, 3])
  .get()

// NOT IN
const users = await db().table('users')
  .whereNotIn('status', ['banned', 'suspended'])
  .get()</code></pre>

<h3>Where Null / Not Null</h3>

<pre><code class="language-typescript">// WHERE deleted_at IS NULL
const active = await db().table('users')
  .whereNull('deleted_at')
  .get()

// WHERE email_verified_at IS NOT NULL
const verified = await db().table('users')
  .whereNotNull('email_verified_at')
  .get()</code></pre>

<h3>Where Between</h3>

<pre><code class="language-typescript">const users = await db().table('users')
  .whereBetween('age', [18, 65])
  .get()</code></pre>

<h3>Where Raw</h3>

<p>For conditions that cannot be expressed with the fluent API, use raw SQL:</p>

<pre><code class="language-typescript">const users = await db().table('users')
  .whereRaw('LOWER(email) = ?', ['alice@example.com'])
  .get()</code></pre>

<h2>Joins</h2>

<pre><code class="language-typescript">// Inner join
const results = await db().table('users')
  .join('posts', 'users.id', '=', 'posts.user_id')
  .select('users.name', 'posts.title')
  .get()

// Left join
const results = await db().table('users')
  .leftJoin('profiles', 'users.id', '=', 'profiles.user_id')
  .select('users.name', 'profiles.bio')
  .get()

// Right join
const results = await db().table('posts')
  .rightJoin('users', 'posts.user_id', '=', 'users.id')
  .select('users.name', 'posts.title')
  .get()</code></pre>

<h2>Ordering</h2>

<pre><code class="language-typescript">// Ascending (default)
const users = await db().table('users')
  .orderBy('name')
  .get()

// Descending
const users = await db().table('users')
  .orderBy('created_at', 'desc')
  .get()

// Shorthand for descending
const users = await db().table('users')
  .orderByDesc('created_at')
  .get()

// Multiple order clauses
const users = await db().table('users')
  .orderBy('role')
  .orderBy('name')
  .get()</code></pre>

<h2>Grouping &amp; Having</h2>

<pre><code class="language-typescript">const stats = await db().table('orders')
  .select('status')
  .selectRaw('COUNT(*) as count')
  .groupBy('status')
  .having('count', '&gt;', 10)
  .get()

// Raw having
const stats = await db().table('orders')
  .selectRaw('DATE(created_at) as date, SUM(amount) as total')
  .groupBy('date')
  .havingRaw('SUM(amount) &gt; ?', [1000])
  .get()</code></pre>

<h2>Limiting &amp; Offsetting</h2>

<pre><code class="language-typescript">// Get 10 rows starting from row 20
const users = await db().table('users')
  .limit(10)
  .offset(20)
  .get()

// Aliases
const users = await db().table('users')
  .take(10)    // same as limit(10)
  .skip(20)    // same as offset(20)
  .get()</code></pre>

<h2>Pagination</h2>

<p>The <code>paginate()</code> method runs two queries: a <code>COUNT(*)</code> to get the total number of rows, then a <code>LIMIT/OFFSET</code> query to get the current page's data.</p>

<pre><code class="language-typescript">const result = await db().table('users')
  .where('active', true)
  .orderBy('name')
  .paginate(1, 15)   // page 1, 15 per page</code></pre>

<p>The result is a <code>PaginationResult</code> object:</p>

<pre><code class="language-typescript">interface PaginationResult {
  data: Record&lt;string, any&gt;[]  // The rows for the current page
  total: number                 // Total matching rows across all pages
  perPage: number               // Items per page
  currentPage: number           // Current page number
  lastPage: number              // Last page number
  from: number                  // First item index (1-based)
  to: number                    // Last item index
  hasMore: boolean              // Whether there are more pages
}</code></pre>

<h2>Aggregates</h2>

<pre><code class="language-typescript">// Count
const total = await db().table('users').count()
const active = await db().table('users').where('active', true).count()

// Sum
const revenue = await db().table('orders').sum('amount')

// Average
const avgAge = await db().table('users').avg('age')

// Min / Max
const oldest = await db().table('users').min('birth_date')
const newest = await db().table('users').max('created_at')</code></pre>

<h2>Retrieving Results</h2>

<h3>Getting All Rows</h3>

<pre><code class="language-typescript">// Returns an array of row objects
const users = await db().table('users').get()</code></pre>

<h3>Getting a Single Row</h3>

<pre><code class="language-typescript">// Returns the first row or null
const user = await db().table('users').where('id', 1).first()

// Returns the first row or throws ModelNotFoundError
const user = await db().table('users').where('id', 1).firstOrFail()

// Find by primary key (shorthand)
const user = await db().table('users').find(1)</code></pre>

<h3>Getting a Single Column Value</h3>

<pre><code class="language-typescript">// Get a single value
const name = await db().table('users').where('id', 1).value('name')

// Get an array of values from one column
const emails = await db().table('users').pluck('email')</code></pre>

<h3>Checking Existence</h3>

<pre><code class="language-typescript">const hasAdmin = await db().table('users')
  .where('role', 'admin')
  .exists()

const noSuperAdmin = await db().table('users')
  .where('role', 'super_admin')
  .doesntExist()</code></pre>

<h2>Inserting</h2>

<pre><code class="language-typescript">// Insert a single row
await db().table('users').insert({
  name: 'Alice',
  email: 'alice@example.com',
})

// Insert multiple rows
await db().table('users').insert([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
])

// Insert and get the auto-generated ID
const id = await db().table('users').insertGetId({
  name: 'Alice',
  email: 'alice@example.com',
})</code></pre>

<h2>Updating</h2>

<pre><code class="language-typescript">// Update matching rows, returns number of affected rows
const affected = await db().table('users')
  .where('id', 1)
  .update({ name: 'Alice Smith' })

// Update or insert (upsert)
await db().table('settings')
  .updateOrInsert(
    { key: 'theme' },       // conditions to match
    { value: 'dark' }       // data to set
  )</code></pre>

<div class="warning">
  <strong>Warning:</strong> Calling <code>update()</code> without a <code>where()</code> clause will update <em>every</em> row in the table. Always add conditions before updating.
</div>

<h2>Deleting</h2>

<pre><code class="language-typescript">// Delete matching rows, returns number of affected rows
const deleted = await db().table('users')
  .where('active', false)
  .delete()

// Truncate the entire table (resets auto-increment)
await db().table('logs').truncate()</code></pre>

<h2>Raw Expressions</h2>

<p>Use <code>raw()</code> to inject raw SQL into any part of a query. Bindings are supported for safety.</p>

<pre><code class="language-typescript">import { raw } from '@mantiq/database'

// In a select
const results = await db().table('orders')
  .select(raw('DATE(created_at) as order_date'), 'status')
  .groupBy('order_date', 'status')
  .get()

// In an update
await db().table('products')
  .where('id', 1)
  .update({ views: raw('views + 1') })</code></pre>

<h2>Debugging</h2>

<p>Use <code>toSql()</code> and <code>getBindings()</code> to inspect the generated SQL without executing the query:</p>

<pre><code class="language-typescript">const query = db().table('users')
  .where('active', true)
  .orderBy('name')
  .limit(10)

console.log(query.toSql())
// SELECT * FROM "users" WHERE "active" = ? ORDER BY "name" ASC LIMIT 10

console.log(query.getBindings())
// [true]</code></pre>

<h2>Cloning Queries</h2>

<p>Use <code>clone()</code> to create an independent copy of a query builder. This is useful when you need to run variations of the same base query.</p>

<pre><code class="language-typescript">const base = db().table('users').where('active', true)

const admins = await base.clone().where('role', 'admin').get()
const total = await base.clone().count()</code></pre>

<div class="note">
  <strong>Tip:</strong> The query builder is mutable &mdash; methods like <code>where()</code> modify and return the same instance. If you need to reuse a base query, always <code>clone()</code> it before adding additional conditions.
</div>
`
}
