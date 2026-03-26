export default {
  title: 'Models',
  content: `
<h2>Introduction</h2>
<p>MantiqJS includes a full-featured Active Record ORM inspired by Laravel's Eloquent. Each database table has a corresponding <code>Model</code> class that provides a rich API for querying and manipulating data. Models handle CRUD operations, type casting, mass assignment protection, soft deletes, and serialization out of the box.</p>

<h2>Defining Models</h2>
<p>To create a model, extend the <code>Model</code> base class from <code>@mantiq/database</code>. By convention, the table name is inferred from the class name (pluralized and lowercased), so you do not need to set it explicitly:</p>

<pre><code class="language-typescript">import { Model } from '@mantiq/database'

export class Post extends Model {
  static override fillable = ['title', 'body', 'author_id']
  static override hidden = ['internal_notes']
}
</code></pre>

<p>You can also generate a model using the CLI:</p>

<pre><code class="language-bash">bun mantiq make:model Post

# Create a model with a migration
bun mantiq make:model Post --migration
</code></pre>

<h2>Model Configuration</h2>
<p>Models are configured through static properties. These use convention over configuration &mdash; the defaults work for most cases:</p>

<pre><code class="language-typescript">import { Model } from '@mantiq/database'

export class User extends Model {
  // Table name is inferred as 'users' by convention
  // Primary key defaults to 'id'
  // Timestamps default to true (manages created_at/updated_at)

  static override fillable: string[] = ['name', 'email', 'password']
  static override hidden: string[] = ['password', 'remember_token']

  static override casts: Record&lt;string, CastType&gt; = {
    is_active: 'boolean',
    metadata: 'json',
    created_at: 'date',
  }
}
</code></pre>

<p>You can override any default if your table does not follow conventions:</p>

<pre><code class="language-typescript">class LegacyUser extends Model {
  static override table = 'tbl_users'     // non-standard table name
  static override primaryKey = 'user_id'  // non-standard primary key
  static override timestamps = false      // no created_at/updated_at
}
</code></pre>

<h3>Mass Assignment: fillable &amp; guarded</h3>
<p>The <code>fillable</code> array defines which attributes can be set through mass assignment methods like <code>fill()</code> and <code>create()</code>. The <code>guarded</code> array defines attributes that are never mass-assignable. By default, <code>id</code> is guarded.</p>
<p>If <code>fillable</code> is non-empty, only listed attributes are assignable. If <code>fillable</code> is empty, all attributes except those in <code>guarded</code> are assignable.</p>

<p>Never leave both <code>fillable</code> and <code>guarded</code> empty in a production model &mdash; this would allow mass assignment of every column, including sensitive fields like <code>is_admin</code>.</p>

<h2>The User Model</h2>
<p>The User model uses the <code>AuthenticatableModel</code> mixin from <code>@mantiq/auth</code> to add authentication support. This mixin provides default implementations for all authentication methods:</p>

<pre><code class="language-typescript">import { AuthenticatableModel } from '@mantiq/auth'
import { Model } from '@mantiq/database'

export class User extends AuthenticatableModel(Model) {
  static override fillable = ['name', 'email', 'password']
  static override hidden = ['password', 'remember_token']
}
</code></pre>

<p>The <code>AuthenticatableModel</code> mixin provides <code>getAuthIdentifier()</code>, <code>getAuthPassword()</code>, <code>getRememberToken()</code>, <code>setRememberToken()</code>, and API token methods (<code>createToken()</code>, <code>tokenCan()</code>) automatically, using conventional column names (<code>id</code>, <code>password</code>, <code>remember_token</code>).</p>

<h2>Creating Records</h2>
<p>Create a new record using the static <code>create()</code> method or by instantiating, filling, and saving:</p>

<pre><code class="language-typescript">// Static create &mdash; inserts and returns the saved model
const user = await User.create({
  name: 'Alice',
  email: 'alice@example.com',
  password: hashedPassword,
})

// Manual instantiation
const user = new User()
user.fill({ name: 'Bob', email: 'bob@example.com' })
await user.save()

// Update or create &mdash; finds existing record or creates a new one
const user = await User.updateOrCreate(
  { email: 'alice@example.com' },         // search conditions
  { name: 'Alice Smith', password: '...' } // data to set
)
</code></pre>

<h2>Retrieving Records</h2>
<p>Models provide static methods that return model instances rather than plain objects:</p>

<pre><code class="language-typescript">// Retrieve all records
const users = await User.all()

// Find by primary key
const user = await User.find(1)          // returns User | null
const user = await User.findOrFail(1)    // returns User or throws ModelNotFoundError

// First matching record
const admin = await User.where('role', 'admin').first()
const admin = await User.where('role', 'admin').firstOrFail()

// Conditional queries
const users = await User.where('is_active', true).get()
const users = await User.where('age', '&gt;', 18).get()
const users = await User.whereIn('id', [1, 2, 3]).get()

// Counting
const total = await User.count()

// Pagination
const page = await User.paginate(1, 15)
// page.data, page.total, page.currentPage, page.lastPage, page.hasMore
</code></pre>

<h2>Updating Records</h2>
<p>Modify attributes on a model instance and call <code>save()</code>. Only dirty (changed) attributes are included in the UPDATE query:</p>

<pre><code class="language-typescript">const user = await User.findOrFail(1)
user.set('name', 'Alice Smith')
await user.save()  // UPDATE users SET name = 'Alice Smith', updated_at = NOW() WHERE id = 1

// Bulk update via query builder
await User.where('is_active', false).update({ archived: true })
</code></pre>

<p>You can check whether a model has unsaved changes with <code>isDirty()</code> and <code>isClean()</code>:</p>

<pre><code class="language-typescript">user.set('name', 'New Name')
user.isDirty()        // true
user.isDirty('name')  // true
user.isDirty('email') // false
user.isClean()        // false
</code></pre>

<h2>Deleting Records</h2>

<pre><code class="language-typescript">const user = await User.findOrFail(1)
await user.delete()

// Bulk delete
await User.where('created_at', '&lt;', cutoffDate).delete()
</code></pre>

<h2>Relationships</h2>
<p>Models support four relationship types. Define them as methods on your model class:</p>

<pre><code class="language-typescript">import { Model } from '@mantiq/database'

export class Post extends Model {
  static override fillable = ['title', 'body', 'user_id']

  // A post belongs to a user
  author() {
    return this.belongsTo(User, 'user_id')
  }

  // A post has many comments
  comments() {
    return this.hasMany(Comment, 'post_id')
  }
}

export class User extends Model {
  // A user has many posts
  posts() {
    return this.hasMany(Post, 'user_id')
  }

  // A user has one profile
  profile() {
    return this.hasOne(Profile, 'user_id')
  }

  // A user belongs to many roles
  roles() {
    return this.belongsToMany(Role, 'user_roles', 'user_id', 'role_id')
  }
}
</code></pre>

<h2>Query Scopes</h2>
<p>Query scopes let you encapsulate common query constraints into reusable static methods. Define a method prefixed with <code>scope</code> on your model:</p>

<pre><code class="language-typescript">class User extends Model {
  static scopeActive(query: ModelQueryBuilder&lt;User&gt;) {
    return query.where('is_active', true)
  }

  static scopeRole(query: ModelQueryBuilder&lt;User&gt;, role: string) {
    return query.where('role', role)
  }
}

// Usage &mdash; the scope prefix is dropped and the first letter lowercased
const activeUsers = await User.active().get()
const admins = await User.role('admin').get()
</code></pre>

<h2>Soft Deletes</h2>
<p>When <code>softDelete</code> is enabled, calling <code>delete()</code> sets the <code>deleted_at</code> column instead of removing the row. All queries automatically exclude soft-deleted records.</p>

<pre><code class="language-typescript">class Post extends Model {
  static override softDelete = true
}

const post = await Post.findOrFail(1)

// Soft delete &mdash; sets deleted_at to the current timestamp
await post.delete()
post.isTrashed()  // true

// Include soft-deleted records
const allPosts = await Post.withTrashed().get()

// Restore a soft-deleted record
await post.restore()
post.isTrashed()  // false

// Permanently delete (bypasses soft deletes)
await post.forceDelete()
</code></pre>

<h2>Timestamps</h2>
<p>When <code>timestamps</code> is <code>true</code> (the default), the model automatically manages <code>created_at</code> and <code>updated_at</code> columns:</p>
<ul>
  <li>On insert, both <code>created_at</code> and <code>updated_at</code> are set to the current time.</li>
  <li>On update, <code>updated_at</code> is refreshed automatically.</li>
</ul>
<p>Set <code>static override timestamps = false</code> to disable this behavior.</p>

<h2>Type Casting</h2>
<p>The <code>casts</code> property defines how attributes are cast when read from the database. This ensures consistent types in your application code:</p>

<pre><code class="language-typescript">static override casts: Record&lt;string, CastType&gt; = {
  is_active: 'boolean',  // DB 1/0 &rarr; true/false
  metadata: 'json',      // JSON string &rarr; parsed object
  settings: 'array',     // JSON string &rarr; parsed array
  age: 'int',            // string &rarr; integer
  score: 'float',        // string &rarr; floating point
  created_at: 'date',    // string &rarr; Date object
  updated_at: 'datetime' // string &rarr; Date object
}
</code></pre>

<p>Available cast types: <code>int</code>, <code>float</code>, <code>boolean</code>, <code>string</code>, <code>json</code>, <code>date</code>, <code>datetime</code>, <code>array</code>.</p>

<h2>Accessors &amp; Mutators</h2>
<p>Define custom getters and setters by following the naming convention <code>get&lt;Key&gt;Attribute</code> and <code>set&lt;Key&gt;Attribute</code>:</p>

<pre><code class="language-typescript">class User extends Model {
  getFullNameAttribute(): string {
    return \`\${this.get('first_name')} \${this.get('last_name')}\`
  }

  setPasswordAttribute(value: string): void {
    this._attributes['password'] = hashSync(value)
  }
}

user.getAttribute('fullName')  // 'Alice Smith'
user.setAttribute('password', 'secret')  // stored as hash
</code></pre>

<h2>Serialization</h2>
<p>Convert model instances to plain objects or JSON. The <code>hidden</code> property controls which attributes are excluded from serialization:</p>

<pre><code class="language-typescript">class User extends Model {
  static override hidden: string[] = ['password', 'remember_token']
}

const user = await User.findOrFail(1)

// Plain object &mdash; excludes hidden attributes, applies casts, includes loaded relations
const obj = user.toObject()

// Equivalent to toObject() &mdash; used by JSON.stringify()
const json = user.toJSON()
</code></pre>

<p>The <code>toObject()</code> method also includes any eagerly loaded relationships as nested objects or arrays on the returned object.</p>

<h2>Force Fill</h2>
<p>When you need to bypass mass assignment protection (e.g., in seeders or admin operations), use <code>forceFill()</code>:</p>

<pre><code class="language-typescript">const user = new User()
user.forceFill({ id: 1, name: 'System', is_admin: true })
await user.save()
</code></pre>
`
}
