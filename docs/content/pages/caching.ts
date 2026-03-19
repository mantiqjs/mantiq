export default {
  title: 'Caching',
  content: `
<h2>Introduction</h2>
<p>MantiqJS provides a unified caching API with multiple driver backends. Caching allows you to store frequently accessed data in a fast-access store, reducing database queries and expensive computations. The cache system supports Memory, File, and Null drivers out of the box, and can be extended with custom drivers.</p>

<h2>Configuration</h2>
<p>Cache settings are defined in the <code>cache</code> section of your application config:</p>

<pre><code class="language-typescript">// config/cache.ts
import { env } from '@mantiq/core'

export default {
  default: env('CACHE_DRIVER', 'memory'),

  stores: {
    memory: {},

    file: {
      path: 'storage/cache',
    },

    null: {},
  },
}
</code></pre>

<h3>Available Drivers</h3>
<table>
  <thead><tr><th>Driver</th><th>Description</th><th>Use Case</th></tr></thead>
  <tbody>
    <tr><td><code>memory</code></td><td>In-process Map storage. Fast, but cleared on restart.</td><td>Development, single-process apps</td></tr>
    <tr><td><code>file</code></td><td>Filesystem-based storage. Persists across restarts.</td><td>Production (single server)</td></tr>
    <tr><td><code>null</code></td><td>No-op driver. All reads return undefined.</td><td>Testing, disabling cache</td></tr>
  </tbody>
</table>

<h2>The cache() Helper</h2>
<p>The <code>cache()</code> helper provides global access to the cache manager:</p>

<pre><code class="language-typescript">import { cache } from '@mantiq/core'

// Access the CacheManager (proxies to the default store)
const manager = cache()

// Access a specific store
const fileCache = cache().store('file')
</code></pre>

<h2>Storing Items</h2>

<pre><code class="language-typescript">// Store a value permanently (no expiration)
await cache().put('key', 'value')

// Store with a TTL (time-to-live) in seconds
await cache().put('key', 'value', 3600)   // expires in 1 hour
await cache().put('key', 'value', 60)     // expires in 1 minute

// Store any serializable value
await cache().put('user:1', { name: 'Alice', email: 'alice@example.com' })
await cache().put('count', 42)
await cache().put('tags', ['javascript', 'typescript', 'bun'])
</code></pre>

<h2>Retrieving Items</h2>

<pre><code class="language-typescript">// Get a value (returns undefined if not found or expired)
const value = await cache().get('key')

// Get with a default value
const name = await cache().get('username', 'Guest')

// Get with type hint
const user = await cache().get&lt;{ name: string; email: string }&gt;('user:1')
</code></pre>

<h2>Checking Existence</h2>

<pre><code class="language-typescript">// Check if a key exists and has not expired
const exists = await cache().has('key')  // true or false
</code></pre>

<h2>Removing Items</h2>

<pre><code class="language-typescript">// Remove a specific key
const removed = await cache().forget('key')  // true if the key existed

// Remove ALL items from the cache
await cache().flush()
</code></pre>

<div class="warning">
<p><code>flush()</code> removes <strong>every</strong> item in the cache store, not just items from your application. Use it carefully, especially with shared cache stores.</p>
</div>

<h2>TTL (Time-to-Live)</h2>
<p>The TTL parameter specifies how long a cached item should be stored, in <strong>seconds</strong>:</p>

<pre><code class="language-typescript">// Common TTL values
await cache().put('key', value, 60)       // 1 minute
await cache().put('key', value, 300)      // 5 minutes
await cache().put('key', value, 3600)     // 1 hour
await cache().put('key', value, 86400)    // 1 day
await cache().put('key', value, 604800)   // 1 week

// No TTL = stored permanently (until manually forgotten or flushed)
await cache().put('key', value)
</code></pre>

<p>When an item's TTL expires, subsequent <code>get()</code> calls return <code>undefined</code> and <code>has()</code> returns <code>false</code>.</p>

<h2>Using Specific Stores</h2>
<p>Switch between cache stores using the <code>store()</code> method:</p>

<pre><code class="language-typescript">// Use the file cache for persistent data
await cache().store('file').put('settings', appSettings, 86400)
const settings = await cache().store('file').get('settings')

// Use memory cache for short-lived, frequently accessed data
await cache().store('memory').put('rate:user:1', requestCount, 60)
</code></pre>

<h2>Practical Examples</h2>

<h3>Caching Database Queries</h3>
<pre><code class="language-typescript">class PostController {
  async index() {
    // Check cache first
    let posts = await cache().get&lt;Post[]&gt;('posts:featured')

    if (!posts) {
      // Cache miss — fetch from database
      posts = await Post.where('featured', true)
        .orderBy('created_at', 'desc')
        .limit(10)
        .get()

      // Store in cache for 5 minutes
      await cache().put('posts:featured', posts, 300)
    }

    return MantiqResponse.json(posts)
  }
}
</code></pre>

<h3>Cache Invalidation</h3>
<pre><code class="language-typescript">class PostController {
  async store(request: MantiqRequest) {
    const post = await Post.create(await request.input())

    // Invalidate the cached list since we added a new post
    await cache().forget('posts:featured')

    return MantiqResponse.json(post.toObject(), 201)
  }
}
</code></pre>

<h3>Caching Configuration Data</h3>
<pre><code class="language-typescript">async function getAppSettings(): Promise&lt;Record&lt;string, any&gt;&gt; {
  const cached = await cache().get('app:settings')
  if (cached) return cached

  const settings = await db().table('settings').get()
  await cache().put('app:settings', settings, 3600)
  return settings
}
</code></pre>

<h2>Extending with Custom Drivers</h2>
<p>Register a custom cache driver using the <code>extend()</code> method on the <code>CacheManager</code>:</p>

<pre><code class="language-typescript">import { CacheManager } from '@mantiq/core'
import type { CacheStore } from '@mantiq/core'

const manager = app().make(CacheManager)

manager.extend('redis', () =&gt; {
  return new RedisCacheStore({
    host: config('cache.stores.redis.host'),
    port: config('cache.stores.redis.port'),
  })
})

// Now available as:
await cache().store('redis').put('key', 'value')
</code></pre>

<p>Custom drivers must implement the <code>CacheStore</code> interface:</p>

<pre><code class="language-typescript">interface CacheStore {
  get&lt;T = unknown&gt;(key: string): Promise&lt;T | undefined&gt;
  put(key: string, value: unknown, ttl?: number): Promise&lt;void&gt;
  forget(key: string): Promise&lt;boolean&gt;
  has(key: string): Promise&lt;boolean&gt;
  flush(): Promise&lt;void&gt;
}
</code></pre>
`
}
