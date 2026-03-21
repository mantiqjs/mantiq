export default {
  title: 'Relationships',
  content: `
<h2>Introduction</h2>
<p>Database tables are often related to one another. MantiqJS models support four relationship types: <strong>hasOne</strong>, <strong>hasMany</strong>, <strong>belongsTo</strong>, and <strong>belongsToMany</strong>. Relationships are defined as instance methods on your model that return a relation object, and they can be eagerly loaded to avoid the N+1 query problem.</p>

<h2>Defining Relationships</h2>

<h3>One to One (hasOne)</h3>
<p>A one-to-one relationship links one model to exactly one related model. For example, a <code>User</code> has one <code>Profile</code>:</p>

<pre><code class="language-typescript">import { Model } from '@mantiq/database'

class User extends Model {
  static override table = 'users'

  profile() {
    return this.hasOne(Profile, 'user_id')
  }
}

class Profile extends Model {
  static override table = 'profiles'
}
</code></pre>

<p>The first argument is the related model class. The second argument is the foreign key on the related table. If omitted, MantiqJS infers it from the parent model name (<code>user_id</code> for <code>User</code>).</p>

<pre><code class="language-typescript">const user = await User.findOrFail(1)
const profile = await user.profile().get()       // Profile | null
const profile = await user.profile().getOrFail()  // Profile or throws ModelNotFoundError
</code></pre>

<h3>One to Many (hasMany)</h3>
<p>A one-to-many relationship links one model to multiple related models. For example, a <code>User</code> has many <code>Post</code> records:</p>

<pre><code class="language-typescript">class User extends Model {
  static override table = 'users'

  posts() {
    return this.hasMany(Post, 'user_id')
  }
}
</code></pre>

<pre><code class="language-typescript">const user = await User.findOrFail(1)
const posts = await user.posts().get()   // Post[]

// Create a related record through the relationship
const post = await user.posts().create({
  title: 'My First Post',
  body: 'Hello world!',
})

// Access the underlying query builder for further constraints
const recentPosts = await user.posts().query()
  .where('created_at', '&gt;', lastWeek)
  .orderBy('created_at', 'desc')
  .get()
</code></pre>

<h3>Inverse One to One / One to Many (belongsTo)</h3>
<p>The <code>belongsTo</code> relationship is the inverse of <code>hasOne</code> and <code>hasMany</code>. It defines the "child" side that holds the foreign key:</p>

<pre><code class="language-typescript">class Post extends Model {
  static override table = 'posts'

  author() {
    return this.belongsTo(User, 'user_id')
  }
}
</code></pre>

<p>The second argument is the foreign key column on <strong>this</strong> model's table. The optional third argument is the owner key on the related model (defaults to the related model's primary key).</p>

<pre><code class="language-typescript">const post = await Post.findOrFail(1)
const author = await post.author().get()       // User | null
const author = await post.author().getOrFail() // User or throws
</code></pre>

<h3>Many to Many (belongsToMany)</h3>
<p>A many-to-many relationship uses a pivot (junction) table. For example, users and roles:</p>

<pre><code class="language-typescript">class User extends Model {
  static override table = 'users'

  roles() {
    return this.belongsToMany(Role, 'role_user', 'user_id', 'role_id')
  }
}

class Role extends Model {
  static override table = 'roles'

  users() {
    return this.belongsToMany(User, 'role_user', 'role_id', 'user_id')
  }
}
</code></pre>

<p>The arguments are: related model, pivot table name, foreign key (this model's key in the pivot), and related key (related model's key in the pivot). If omitted, MantiqJS will infer the pivot table name by joining the two model names in alphabetical order.</p>

<h3>Pivot Table Operations</h3>
<p>The <code>belongsToMany</code> relationship provides methods for managing the pivot table:</p>

<pre><code class="language-typescript">const user = await User.findOrFail(1)

// Attach roles by ID
await user.roles().attach([1, 2, 3])

// Detach specific roles
await user.roles().detach([2])

// Detach all roles
await user.roles().detach()

// Sync — replaces current associations with exactly the given IDs
await user.roles().sync([1, 3, 5])

// Retrieve all related models
const roles = await user.roles().get()  // Role[]
</code></pre>

<h2>Eager Loading</h2>
<p>By default, relationships are lazy-loaded: they execute a query each time you access them. This can lead to the N+1 query problem when iterating over a collection. Eager loading solves this by loading relationships upfront with just two queries, regardless of the number of parent records.</p>

<h3>Basic Eager Loading</h3>

<pre><code class="language-typescript">// Without eager loading (N+1 problem)
const users = await User.all()
for (const user of users) {
  const posts = await user.posts().get()  // one query per user!
}

// With eager loading (2 queries total)
const users = await User.with('posts').get()
// Query 1: SELECT * FROM users
// Query 2: SELECT * FROM posts WHERE user_id IN (1, 2, 3, ...)
</code></pre>

<p>Loaded relationships are stored on the model instance and accessible via <code>toObject()</code>.</p>

<h3>Loading Multiple Relationships</h3>
<p>Pass multiple relation names to <code>with()</code>:</p>

<pre><code class="language-typescript">const users = await User.with('posts', 'profile').get()
// Each user now has .posts (Post[]) and .profile (Profile | null)
</code></pre>

<h3>Nested Eager Loading</h3>
<p>Use dot notation to eagerly load nested relationships:</p>

<pre><code class="language-typescript">const users = await User.with('posts.comments').get()
// Loads users, their posts, and each post's comments
// Query 1: SELECT * FROM users
// Query 2: SELECT * FROM posts WHERE user_id IN (...)
// Query 3: SELECT * FROM comments WHERE post_id IN (...)
</code></pre>

<h3>Constrained Eager Loading</h3>
<p>You can add constraints to the eager-loaded query by passing an object with a callback:</p>

<pre><code class="language-typescript">const users = await User.with({
  posts: (query) =&gt; query.where('published', true).orderBy('created_at', 'desc')
}).get()
</code></pre>

<p>This loads only published posts for each user, ordered by date.</p>

<h2>How Eager Loading Works</h2>
<p>Eager loading uses an N+1-safe approach. Rather than running a query for each parent, it collects all parent IDs and runs a single query with a <code>WHERE IN</code> clause:</p>

<ol>
  <li>Fetch all parent models: <code>SELECT * FROM users</code></li>
  <li>Collect parent IDs: <code>[1, 2, 3, ...]</code></li>
  <li>Fetch related models: <code>SELECT * FROM posts WHERE user_id IN (1, 2, 3, ...)</code></li>
  <li>Match related models to parents in memory</li>
</ol>

<p>This results in exactly two queries per relationship, regardless of how many parent records exist.</p>

<p>For <code>belongsToMany</code> relationships, eager loading runs three queries: one for the parents, one for the pivot rows, and one for the related models.</p>

<h2>Relationship Method Signatures</h2>
<p>For reference, here are the full method signatures for each relationship type:</p>

<pre><code class="language-typescript">// hasOne(RelatedModel, foreignKey?, localKey?)
this.hasOne(Profile, 'user_id')        // Profile.user_id = User.id

// hasMany(RelatedModel, foreignKey?, localKey?)
this.hasMany(Post, 'user_id')          // Post.user_id = User.id

// belongsTo(RelatedModel, foreignKey?, ownerKey?)
this.belongsTo(User, 'user_id')        // Post.user_id = User.id

// belongsToMany(RelatedModel, pivotTable?, foreignKey?, relatedKey?)
this.belongsToMany(Role, 'role_user', 'user_id', 'role_id')
</code></pre>

<p>When foreign keys are omitted, MantiqJS infers them from the model name using snake_case conventions (e.g., <code>User</code> becomes <code>user_id</code>).</p>
`
}
