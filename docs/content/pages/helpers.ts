export default {
  title: 'Helpers',
  content: `
<h2 id="introduction">Introduction</h2>
<p>The <code>@mantiq/helpers</code> package is a standalone utility layer with zero dependencies on other Mantiq packages. It provides string, array, number, collection, HTTP client, type guards, async primitives, Result types, duration math, and more. Everything is importable from a single entry point:</p>

<pre><code class="language-typescript">import { Str, Arr, Num, collect, Http, is, Result, Duration, sleep, retry } from '@mantiq/helpers'
</code></pre>

<h2 id="str">Str &mdash; String Utilities</h2>
<p>The <code>Str</code> object provides static methods for common string operations: case conversion, slug generation, random string generation, masking, searching, and more.</p>

<h3 id="case-conversion">Case Conversion</h3>
<pre><code class="language-typescript">import { Str } from '@mantiq/helpers'

Str.camel('foo_bar')       // 'fooBar'
Str.snake('fooBar')        // 'foo_bar'
Str.kebab('fooBar')        // 'foo-bar'
Str.pascal('foo_bar')      // 'FooBar'
Str.title('hello world')   // 'Hello World'
Str.headline('fooBar')     // 'Foo Bar'
</code></pre>

<h3 id="slug-generation">Slug Generation</h3>
<pre><code class="language-typescript">Str.slug('Hello World!')          // 'hello-world'
Str.slug('Hello World', '_')      // 'hello_world'
</code></pre>
<p>The slug method normalizes Unicode (NFD), strips diacritics, lowercases, and replaces non-alphanumerics with the separator.</p>

<h3 id="random-strings-and-ids">Random Strings &amp; IDs</h3>
<pre><code class="language-typescript">Str.random()        // 16-char alphanumeric string (secure randomness)
Str.random(8)       // 8-char alphanumeric string
Str.uuid()          // crypto.randomUUID()
Str.ulid()          // 26-char Crockford Base32 ULID
Str.password()      // 32-char password with mixed charset
Str.password(16)    // 16-char password

Str.isUuid(Str.uuid())   // true
Str.isUlid(Str.ulid())   // true
</code></pre>

<h3 id="masking-and-truncation">Masking &amp; Truncation</h3>
<pre><code class="language-typescript">Str.mask('1234567890', '*', 4)             // '1234******'
Str.truncate('Hello World', 8)             // 'Hello...'
Str.words('The quick brown fox jumps', 3)  // 'The quick brown...'
</code></pre>

<h3 id="search-and-extraction">Search &amp; Extraction</h3>
<pre><code class="language-typescript">Str.contains('hello world', 'world')              // true
Str.contains('hello world', ['foo', 'world'])      // true
Str.startsWith('hello', 'he')                      // true
Str.endsWith('hello', 'lo')                        // true

Str.before('hello@world', '@')       // 'hello'
Str.after('hello@world', '@')        // 'world'
Str.between('[value]', '[', ']')     // 'value'

Str.is('foo*', 'foobar')             // true (wildcard matching)
</code></pre>

<h3 id="wrapping-and-ensuring">Wrapping &amp; Ensuring</h3>
<pre><code class="language-typescript">Str.wrap('hello', '"')           // '"hello"'
Str.unwrap('"hello"', '"')       // 'hello'
Str.start('/path', '/')          // '/path' (ensures prefix without duplication)
Str.finish('path/', '/')         // 'path/' (ensures suffix without duplication)
</code></pre>

<h3 id="fluent-stringable">Fluent Stringable</h3>
<p><code>Str.of(value)</code> returns a <code>Stringable</code> instance that supports immutable method chaining. Every transform returns a new <code>Stringable</code>; call <code>.toString()</code> to get the final string.</p>

<pre><code class="language-typescript">import { Str } from '@mantiq/helpers'

const slug = Str.of('Hello World')
  .title()
  .slug()
  .toString()   // 'hello-world'

const result = Str.of('  hello world  ')
  .trim()
  .upper()
  .append('!')
  .toString()   // 'HELLO WORLD!'

// Conditional transforms
Str.of('hello')
  .when(true, s =&gt; s.upper())
  .toString()   // 'HELLO'

// Predicates return primitives
Str.of('hello').contains('ell')     // true
Str.of('').isEmpty()                // true
Str.of('hello').length              // 5
</code></pre>

<h2 id="arr">Arr &mdash; Array &amp; Dot-Notation Utilities</h2>
<p>The <code>Arr</code> object provides utilities for working with arrays and objects, including dot-notation access for nested data.</p>

<h3 id="dot-notation-access">Dot-Notation Access</h3>
<pre><code class="language-typescript">import { Arr } from '@mantiq/helpers'

const data = { user: { address: { city: 'Paris' } } }

Arr.get(data, 'user.address.city')              // 'Paris'
Arr.get(data, 'user.phone', 'N/A')             // 'N/A' (default value)
Arr.has(data, 'user.address.city')              // true

Arr.set(data, 'user.address.zip', '75001')     // mutates: creates nested keys
Arr.forget(data, 'user.address.zip')            // mutates: deletes the key

// Flatten/expand dot-notation
Arr.dot({ a: { b: 1, c: 2 } })     // { 'a.b': 1, 'a.c': 2 }
Arr.undot({ 'a.b': 1, 'a.c': 2 })  // { a: { b: 1, c: 2 } }
</code></pre>

<h3 id="extraction-and-grouping">Extraction &amp; Grouping</h3>
<pre><code class="language-typescript">const users = [
  { id: 1, name: 'Alice', role: 'admin' },
  { id: 2, name: 'Bob', role: 'user' },
  { id: 3, name: 'Carol', role: 'admin' },
]

Arr.pluck(users, 'name')                  // ['Alice', 'Bob', 'Carol']
Arr.pluck(users, 'name', 'id')           // { 1: 'Alice', 2: 'Bob', 3: 'Carol' }
Arr.keyBy(users, 'id')                    // { 1: { id: 1, ... }, 2: { id: 2, ... }, ... }
Arr.groupBy(users, 'role')               // { admin: [...], user: [...] }
Arr.only(users[0], ['id', 'name'])        // { id: 1, name: 'Alice' }
Arr.except(users[0], ['role'])            // { id: 1, name: 'Alice' }
</code></pre>

<h3 id="sorting-and-searching">Sorting &amp; Searching</h3>
<pre><code class="language-typescript">Arr.sortBy(users, 'name')         // sorted ascending by name (non-mutating)
Arr.sortByDesc(users, 'name')     // sorted descending
Arr.unique([1, 2, 2, 3, 3])       // [1, 2, 3]
Arr.first(users, u =&gt; u.role === 'admin')   // { id: 1, name: 'Alice', ... }
Arr.last(users)                              // { id: 3, name: 'Carol', ... }
Arr.partition(users, u =&gt; u.role === 'admin')  // [[Alice, Carol], [Bob]]
</code></pre>

<h3 id="reshaping">Reshaping</h3>
<pre><code class="language-typescript">Arr.wrap(null)          // []
Arr.wrap('hello')       // ['hello']
Arr.wrap([1, 2])        // [1, 2] (passthrough)

Arr.flatten([1, [2, [3, [4]]]])     // [1, 2, 3, 4]
Arr.flatten([1, [2, [3]]], 1)       // [1, 2, [3]] (limited depth)
Arr.chunk([1, 2, 3, 4, 5], 2)      // [[1, 2], [3, 4], [5]]
Arr.range(1, 5)                     // [1, 2, 3, 4, 5]
</code></pre>

<h2 id="num">Num &mdash; Number Formatting &amp; Math</h2>
<p>The <code>Num</code> object provides number formatting with locale support and common math operations.</p>

<h3 id="formatting">Formatting</h3>
<pre><code class="language-typescript">import { Num } from '@mantiq/helpers'

Num.format(1234567.89)              // '1,234,567.89'
Num.currency(99.99)                 // '$99.99'
Num.currency(99.99, 'EUR', 'de-DE') // locale-aware formatting
Num.percentage(75)                  // '75%'
Num.abbreviate(1500)                // '1.5K'
Num.abbreviate(1_500_000)           // '1.5M'
Num.ordinal(1)                      // '1st'
Num.ordinal(11)                     // '11th'
Num.fileSize(1_048_576)             // '1 MB'
</code></pre>

<h3 id="clamping-and-rounding">Clamping &amp; Rounding</h3>
<pre><code class="language-typescript">Num.clamp(15, 0, 10)           // 10
Num.between(5, 0, 10)          // true
Num.round(3.456, 2)            // 3.46
Num.floor(3.456, 1)            // 3.4
Num.ceil(3.451, 1)             // 3.5
</code></pre>

<h3 id="statistics">Statistics</h3>
<pre><code class="language-typescript">const values = [10, 20, 30, 40, 50]

Num.sum(values)          // 150
Num.avg(values)          // 30
Num.median(values)       // 30
Num.mode([1, 2, 2, 3])  // 2
Num.stddev(values)       // population standard deviation
Num.percentile(values, 75)
</code></pre>

<h3 id="interpolation">Interpolation</h3>
<pre><code class="language-typescript">Num.lerp(0, 100, 0.5)             // 50
Num.inverseLerp(0, 100, 50)       // 0.5
Num.map(5, 0, 10, 0, 100)         // 50 (maps from one range to another)
</code></pre>

<h2 id="collection">Collection</h2>
<p>The <code>Collection</code> class is a chainable, immutable wrapper around arrays. Create one with the <code>collect()</code> factory function. All transform methods return a new <code>Collection</code> instance.</p>

<pre><code class="language-typescript">import { collect } from '@mantiq/helpers'

const result = collect([1, 2, 3, 4, 5])
  .filter(n =&gt; n &gt; 2)
  .map(n =&gt; n * 10)
  .toArray()   // [30, 40, 50]
</code></pre>

<h3 id="collection-transforms">Transforms</h3>
<pre><code class="language-typescript">const users = collect([
  { name: 'Alice', age: 30, role: 'admin' },
  { name: 'Bob', age: 25, role: 'user' },
  { name: 'Carol', age: 35, role: 'admin' },
])

users.pluck('name').toArray()           // ['Alice', 'Bob', 'Carol']
users.sortBy('age').pluck('name').toArray()  // ['Bob', 'Alice', 'Carol']
users.unique('role').count()            // 2

// Chunking, slicing, taking
collect([1, 2, 3, 4, 5]).chunk(2).toArray()   // [Collection[1,2], Collection[3,4], Collection[5]]
collect([1, 2, 3, 4, 5]).take(3).toArray()    // [1, 2, 3]
collect([1, 2, 3, 4, 5]).take(-2).toArray()   // [4, 5]  (negative takes from end)
collect([1, 2, 3, 4, 5]).skip(2).toArray()    // [3, 4, 5]
</code></pre>

<h3 id="collection-aggregation">Aggregation</h3>
<pre><code class="language-typescript">const prices = collect([10, 20, 30, 40, 50])

prices.sum()       // 150
prices.avg()       // 30
prices.min()       // 10
prices.max()       // 50
prices.median()    // 30
</code></pre>

<h3 id="collection-grouping">Grouping &amp; Partitioning</h3>
<pre><code class="language-typescript">const grouped = users.groupBy('role')
// Map { 'admin' =&gt; Collection[Alice, Carol], 'user' =&gt; Collection[Bob] }

const [admins, others] = users.partition(u =&gt; u.role === 'admin')
admins.count()   // 2
others.count()   // 1

const counts = users.countBy('role')
// Map { 'admin' =&gt; 2, 'user' =&gt; 1 }
</code></pre>

<h3 id="collection-conditionals">Conditionals &amp; Side Effects</h3>
<pre><code class="language-typescript">collect([1, 2, 3])
  .when(true, c =&gt; c.map(n =&gt; n * 2))
  .each(n =&gt; console.log(n))   // 2, 4, 6

const total = collect([1, 2, 3])
  .tap(c =&gt; console.log('Count:', c.count()))
  .pipe(c =&gt; c.sum())   // 6
</code></pre>

<h3 id="lazy-collection">LazyCollection</h3>
<p>For large datasets, use <code>lazy()</code> or <code>generate()</code> to create a <code>LazyCollection</code>. Operations are deferred until a terminal method (<code>toArray()</code>, <code>count()</code>, <code>first()</code>, etc.) is called.</p>

<pre><code class="language-typescript">import { lazy, generate, range } from '@mantiq/helpers'

// Lazy from existing data
const result = lazy([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  .filter(n =&gt; n % 2 === 0)
  .map(n =&gt; n * 10)
  .take(3)
  .toArray()   // [20, 40, 60] — only iterates as far as needed

// Infinite generator with take
const fibs = generate(function* () {
  let [a, b] = [0, 1]
  while (true) {
    yield a;
    [a, b] = [b, a + b]
  }
}).take(7).toArray()   // [0, 1, 1, 2, 3, 5, 8]

// Lazy range
range(1, 1000000).filter(n =&gt; n % 1000 === 0).take(5).toArray()
// [1000, 2000, 3000, 4000, 5000]

// Convert lazy to eager
const collection = lazy(items).filter(predicate).collect()
</code></pre>

<h2 id="http">Http &mdash; Fluent HTTP Client</h2>
<p>The <code>Http</code> facade provides a fluent interface for making HTTP requests. It wraps the native <code>fetch</code> API with a builder pattern, automatic JSON parsing, error handling, retries, and middleware support.</p>

<h3 id="basic-requests">Basic Requests</h3>
<pre><code class="language-typescript">import { Http } from '@mantiq/helpers'

// Simple GET
const response = await Http.get('https://api.example.com/users')
response.data      // parsed JSON body
response.status    // 200
response.ok        // true

// POST with JSON body (default)
const created = await Http.post('https://api.example.com/users', {
  name: 'Alice',
  email: 'alice@example.com',
})

// PUT, PATCH, DELETE
await Http.put(url, body)
await Http.patch(url, body)
await Http.delete(url)
</code></pre>

<div class="note">
<p>Non-2xx responses throw an <code>HttpError</code> with <code>.response</code> and <code>.status</code> properties attached. Catch these to handle API errors.</p>
</div>

<h3 id="fluent-builder">Fluent Builder</h3>
<pre><code class="language-typescript">const response = await Http
  .baseUrl('https://api.example.com')
  .bearer('my-token')
  .timeout('10s')
  .retry(3, '500ms')
  .get('/users')

// Form-encoded data
await Http.baseUrl('https://api.example.com')
  .asForm()
  .post('/login', { username: 'alice', password: 'secret' })

// Custom headers and query params
await Http
  .withHeaders({ 'X-Custom': 'value' })
  .query({ page: 1, limit: 20 })
  .get('https://api.example.com/items')
</code></pre>

<h3 id="parallel-and-sequential-requests">Parallel &amp; Sequential Requests</h3>
<pre><code class="language-typescript">// Parallel batch (Promise.all)
const [users, posts] = await Http.batch([
  Http.get('/api/users'),
  Http.get('/api/posts'),
])

// Concurrency-limited pool
const results = await Http.pool(
  urls.map(url =&gt; () =&gt; Http.get(url)),
  { concurrency: 5 }
)

// Sequential pipeline — each step receives the prior response
const finalResponse = await Http.pipeline(
  Http.post('/auth/login', credentials),
  (authResponse) =&gt; Http.bearer(authResponse.data.token).get('/api/profile'),
)
</code></pre>

<h3 id="http-middleware">Middleware</h3>
<pre><code class="language-typescript">import type { HttpMiddleware } from '@mantiq/helpers'

const logging: HttpMiddleware = async (request, next) =&gt; {
  console.log('Request:', request.method, request.url)
  const response = await next(request)
  console.log('Response:', response.status)
  return response
}

const response = await Http
  .withMiddleware(logging)
  .get('/api/users')
</code></pre>

<h3 id="http-faking">HTTP Faking (Testing)</h3>
<p>The <code>HttpFake</code> class lets you stub HTTP responses in tests without hitting real endpoints.</p>

<pre><code class="language-typescript">import { Http, HttpFake } from '@mantiq/helpers'

const fake = new HttpFake()

// Stub responses
fake.get('/api/users', {
  status: 200,
  body: [{ id: 1, name: 'Alice' }],
})

fake.post('/api/users', (request) =&gt; ({
  status: 201,
  body: { id: 2, name: 'Bob' },
}))

// Use as middleware or install globally
const response = await Http
  .withMiddleware(fake.middleware())
  .get('/api/users')

// Assert requests were made
fake.assertSent('GET', '/api/users')
fake.assertNotSent('DELETE', '/api/users')
fake.assertSentCount(1)

// Sequence of responses (e.g., simulate retries)
fake.sequence('GET', '/api/health', [
  { status: 503 },
  { status: 503 },
  { status: 200, body: { status: 'ok' } },
])

// Prevent unmatched requests from leaking
fake.preventStrayRequests()
</code></pre>

<h2 id="result">Result &mdash; Typed Error Handling</h2>
<p>The <code>Result</code> type provides Rust-inspired typed error handling, eliminating the need for try/catch in many scenarios. A <code>Result</code> is either <code>Ok</code> (success) or <code>Err</code> (failure).</p>

<pre><code class="language-typescript">import { Result } from '@mantiq/helpers'

// Create Ok and Err values
const ok = Result.ok(42)
const err = Result.err(new Error('something failed'))

ok.isOk()     // true
ok.unwrap()   // 42

err.isErr()       // true
err.unwrapOr(0)   // 0
</code></pre>

<h3 id="wrapping-functions">Wrapping Functions</h3>
<pre><code class="language-typescript">// Wrap a function that might throw
const result = Result.try(() =&gt; JSON.parse(someInput))

if (result.isOk()) {
  console.log(result.unwrap())
} else {
  console.error(result.unwrapErr().message)
}

// Async version
const response = await Result.tryAsync(() =&gt; fetch('/api/data'))
</code></pre>

<h3 id="chaining-results">Chaining &amp; Transforming</h3>
<pre><code class="language-typescript">const value = Result.try(() =&gt; JSON.parse(input))
  .map(data =&gt; data.name)
  .mapErr(err =&gt; new Error(\`Parse failed: \${err.message}\`))
  .unwrapOr('default')

// flatMap / andThen for chaining Result-returning functions
const result = Result.ok(5)
  .andThen(n =&gt; n &gt; 0 ? Result.ok(n * 2) : Result.err(new Error('negative')))
  .unwrap()   // 10

// Pattern matching
const message = Result.try(() =&gt; riskyOperation()).match({
  ok: value =&gt; \`Success: \${value}\`,
  err: error =&gt; \`Failed: \${error.message}\`,
})
</code></pre>

<h3 id="combining-results">Combining Results</h3>
<pre><code class="language-typescript">// All must succeed (short-circuits on first Err)
const all = Result.all([Result.ok(1), Result.ok(2), Result.ok(3)])
all.unwrap()   // [1, 2, 3]

// First success wins
const any = Result.any([Result.err(new Error('a')), Result.ok(42)])
any.unwrap()   // 42

// Separate successes from failures
const [oks, errs] = Result.partition(results)
</code></pre>

<h2 id="duration">Duration &mdash; Fluent Time Math</h2>
<p>The <code>Duration</code> class provides fluent duration building, arithmetic, and formatting.</p>

<pre><code class="language-typescript">import { Duration } from '@mantiq/helpers'

// Create durations
const d = Duration.hours(2).plus(Duration.minutes(30))

d.toMs()        // 9000000
d.toMinutes()   // 150
d.toHuman()     // '2 hours, 30 minutes'
d.toCompact()   // '2h30m'
d.toISO()       // 'PT2H30M'

// Parse from string
Duration.parse('2h30m').toMs()     // 9000000
Duration.parse('500ms').toMs()     // 500

// Arithmetic
Duration.minutes(5).times(3).toSeconds()       // 900
Duration.minutes(10).minus(Duration.seconds(3)).toSeconds()  // 597

// Date arithmetic
const future = Duration.hours(1).fromNow()
const past = Duration.days(7).ago()
Duration.minutes(30).addTo(new Date())

// Comparisons
Duration.hours(1).greaterThan(Duration.minutes(30))   // true
Duration.seconds(0).isZero()                          // true

// Between two dates
const elapsed = Duration.between(startDate, endDate)
elapsed.toHuman()   // '3 hours, 15 minutes'

// Components breakdown
Duration.parse('1d2h30m').toComponents()
// { days: 1, hours: 2, minutes: 30, seconds: 0, milliseconds: 0 }
</code></pre>

<h2 id="is">is &mdash; Runtime Type Guards</h2>
<p>The <code>is</code> object provides a comprehensive set of runtime type guards and predicates. Type-guard methods narrow the TypeScript type.</p>

<pre><code class="language-typescript">import { is } from '@mantiq/helpers'

// Type checks (narrow the type)
is.string('hello')          // true (value is string)
is.number(42)               // true (NaN returns false)
is.integer(42)              // true
is.float(42.5)              // true
is.boolean(true)            // true
is.array([1, 2])            // true
is.plainObject({})          // true (rejects Date, Array, etc.)
is.date(new Date())         // true (rejects invalid dates)
is.promise(Promise.resolve())  // true (duck-types .then)

// Nullish checks
is.null(null)               // true
is.nullish(null)            // true
is.defined(value)           // true if not null/undefined

// Emptiness (null, undefined, '', [], {}, Map(0), Set(0))
is.empty('')                // true
is.empty([])                // true
is.empty(0)                 // false (0 is NOT empty)

// String format validation
is.email('user@example.com')   // true
is.url('https://example.com')  // true
is.uuid('550e8400-e29b-...')   // true
is.json('{"a":1}')             // true
is.ip('192.168.1.1')           // true

// Number checks
is.positive(5)       // true
is.between(5, 0, 10) // true (inclusive)
is.even(4)           // true
</code></pre>

<h2 id="async-utilities">Async Utilities</h2>
<p>A set of async primitives for common concurrency patterns.</p>

<h3 id="sleep">sleep</h3>
<pre><code class="language-typescript">import { sleep } from '@mantiq/helpers'

await sleep(1000)       // sleep 1000ms
await sleep('2s')       // sleep 2 seconds
await sleep('500ms')    // sleep 500ms
</code></pre>

<h3 id="retry">retry</h3>
<pre><code class="language-typescript">import { retry } from '@mantiq/helpers'

// Retry up to 3 times with a 1-second delay
const data = await retry(3, async (attempt) =&gt; {
  console.log(\`Attempt \${attempt}\`)
  const res = await fetch('/api/flaky')
  if (!res.ok) throw new Error('Failed')
  return res.json()
}, '1s')

// Exponential backoff
await retry(5, fetchData, (attempt) =&gt; \`\${Math.pow(2, attempt)}s\`)
</code></pre>

<h3 id="parallel">parallel</h3>
<pre><code class="language-typescript">import { parallel } from '@mantiq/helpers'

// Run tasks with concurrency limit
const results = await parallel(
  urls.map(url =&gt; () =&gt; fetch(url).then(r =&gt; r.json())),
  { concurrency: 5 }
)
</code></pre>

<h3 id="timeout">timeout</h3>
<pre><code class="language-typescript">import { timeout } from '@mantiq/helpers'

// Reject if the promise takes longer than 5 seconds
const data = await timeout(
  fetch('/api/slow'),
  '5s',
  'Request timed out'
)
</code></pre>

<h3 id="debounce-and-throttle">debounce &amp; throttle</h3>
<pre><code class="language-typescript">import { debounce, throttle } from '@mantiq/helpers'

const search = debounce((query: string) =&gt; {
  fetch(\`/api/search?q=\${query}\`)
}, '300ms')

search('h')
search('he')
search('hel')   // only this call executes (after 300ms)
search.cancel() // cancel pending call

const log = throttle(() =&gt; console.log('scroll'), '100ms')
// First call executes immediately, subsequent calls throttled
</code></pre>

<h3 id="waterfall">waterfall</h3>
<pre><code class="language-typescript">import { waterfall } from '@mantiq/helpers'

// Pipe a value through sequential async steps
const result = await waterfall(1, [
  (n) =&gt; n + 1,
  async (n) =&gt; n * 10,
  (n) =&gt; n.toString(),
])
// result: '20'
</code></pre>

<h2 id="object-utilities">Object Utilities</h2>
<pre><code class="language-typescript">import { deepClone, deepMerge, deepEqual, pick, omit, diff } from '@mantiq/helpers'

// Deep clone (handles Date, Map, Set, RegExp, nested objects)
const clone = deepClone({ a: { b: [1, 2] } })

// Deep merge (later sources override)
const merged = deepMerge(
  { a: { b: 1, c: 2 } },
  { a: { c: 3, d: 4 } },
)
// { a: { b: 1, c: 3, d: 4 } }

// Deep equality (handles NaN, Date, RegExp)
deepEqual({ a: 1 }, { a: 1 })   // true

// Pick / omit keys
pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])   // { a: 1, c: 3 }
omit({ a: 1, b: 2, c: 3 }, ['b'])        // { a: 1, c: 3 }

// Diff two objects
diff(
  { name: 'Alice', age: 30 },
  { name: 'Alice', age: 31 },
)
// { age: { from: 30, to: 31 } }
</code></pre>

<h2 id="function-utilities">Function Utilities</h2>
<pre><code class="language-typescript">import { tap, pipe, once, memoize, times } from '@mantiq/helpers'

// tap: side-effect, returns original value
const user = tap(createUser(), u =&gt; sendWelcomeEmail(u))

// pipe: left-to-right composition
const result = pipe(
  5,
  n =&gt; n * 2,
  n =&gt; n + 1,
  n =&gt; n.toString(),
)   // '11'

// once: execute only on first call
const init = once(() =&gt; expensiveSetup())
init()  // runs setup
init()  // returns cached result

// memoize: cache with TTL and max size
const fetchUser = memoize(
  async (id: number) =&gt; Http.get(\`/api/users/\${id}\`),
  { ttl: '5m', maxSize: 100 }
)
fetchUser.cache   // Map of cached entries
fetchUser.clear() // clear cache

// times: run a callback N times
const ids = times(5, i =&gt; i + 1)   // [1, 2, 3, 4, 5]
</code></pre>

<h2 id="pattern-matching">Pattern Matching</h2>
<p>The <code>match</code> function provides functional pattern matching with exact values, arrays, or predicates.</p>

<pre><code class="language-typescript">import { match } from '@mantiq/helpers'

const label = match(statusCode)
  .when(200, 'OK')
  .when([201, 202], 'Created')
  .when(code =&gt; code &gt;= 400 &amp;&amp; code &lt; 500, 'Client Error')
  .when(code =&gt; code &gt;= 500, 'Server Error')
  .otherwise('Unknown')

// Lazy results (only computed if the arm matches)
const result = match(value)
  .when(0, () =&gt; computeExpensiveDefault())
  .when(v =&gt; v &gt; 100, () =&gt; computeExpensiveResult(v))
  .exhaustive()   // throws if no match found
</code></pre>
`
}
