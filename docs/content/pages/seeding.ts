export default {
  title: 'Seeding',
  content: `
<h2>Introduction</h2>

<p>Seeders and factories provide a way to populate your database with test data. Seeders insert specific data (like default roles or admin users), while factories generate random data using a built-in fake data generator. Together, they make it easy to set up development databases, write tests, and demonstrate features.</p>

<h2>Seeders</h2>

<h3>Creating a Seeder</h3>

<p>Generate a new seeder using the CLI:</p>

<pre><code class="language-bash">bun mantiq make:seeder UserSeeder</code></pre>

<p>This creates a file in <code>database/seeders/</code>.</p>

<h3>Writing a Seeder</h3>

<p>A seeder extends the abstract <code>Seeder</code> class and implements a <code>run()</code> method. Use the <code>table()</code> helper to access the query builder for any table.</p>

<pre><code class="language-typescript">// database/seeders/UserSeeder.ts
import { Seeder } from '@mantiq/database'

export class UserSeeder extends Seeder {
  override async run(): Promise&lt;void&gt; {
    await this.table('users').insert([
      {
        name: 'Alice',
        email: 'alice@example.com',
        password: await Bun.password.hash('password'),
        is_active: true,
      },
      {
        name: 'Bob',
        email: 'bob@example.com',
        password: await Bun.password.hash('password'),
        is_active: true,
      },
    ])
  }
}</code></pre>

<h3>The DatabaseSeeder</h3>

<p>The <code>DatabaseSeeder</code> is the entry point for seeding. It calls other seeders in the order you specify. Use the <code>call()</code> method to invoke individual seeders, or <code>callMany()</code> to invoke a list.</p>

<pre><code class="language-typescript">// database/seeders/DatabaseSeeder.ts
import { Seeder } from '@mantiq/database'
import { UserSeeder } from './UserSeeder.ts'
import { PostSeeder } from './PostSeeder.ts'
import { CategorySeeder } from './CategorySeeder.ts'

export class DatabaseSeeder extends Seeder {
  override async run(): Promise&lt;void&gt; {
    // Call seeders one by one
    await this.call(UserSeeder)
    await this.call(CategorySeeder)
    await this.call(PostSeeder)

    // Or call many at once
    // await this.callMany([UserSeeder, CategorySeeder, PostSeeder])
  }
}</code></pre>

<div class="note">
  <strong>Tip:</strong> Order matters when seeding. If <code>PostSeeder</code> creates rows that reference <code>users</code>, make sure <code>UserSeeder</code> runs first.
</div>

<h3>Running Seeders</h3>

<pre><code class="language-bash"># Run the DatabaseSeeder
bun mantiq seed

# Seed after running fresh migrations
bun mantiq migrate:fresh --seed</code></pre>

<h2>Factories</h2>

<p>Factories generate model instances with realistic fake data. They are useful for seeding large datasets and for creating test fixtures.</p>

<h3>Creating a Factory</h3>

<pre><code class="language-bash">bun mantiq make:factory UserFactory</code></pre>

<h3>Writing a Factory</h3>

<p>A factory extends <code>Factory&lt;T&gt;</code> and implements a <code>definition()</code> method that returns an object of attribute values. The method receives an <code>index</code> (the current iteration number) and a <code>fake</code> instance for generating random data.</p>

<pre><code class="language-typescript">// database/factories/UserFactory.ts
import { Factory, Faker } from '@mantiq/database'
import { User } from '../../app/Models/User.ts'

export class UserFactory extends Factory&lt;User&gt; {
  protected override model = User

  override definition(index: number, fake: Faker) {
    return {
      name: fake.name(),
      email: fake.email(),
      password: 'hashed_password',
      is_active: fake.boolean(0.9),
      role: fake.pick(['user', 'admin', 'moderator']),
      created_at: fake.recent(30).toISOString(),
    }
  }
}</code></pre>

<h3>Using Factories</h3>

<pre><code class="language-typescript">const factory = new UserFactory()

// Create a single model (persisted to database)
const user = await factory.create()

// Create multiple models
const users = await factory.count(10).create()

// Create with attribute overrides
const admin = await factory.create({ role: 'admin', is_active: true })

// Make without persisting (in-memory only)
const stub = factory.make()
const stubs = factory.count(5).make()

// Get raw attribute objects (not model instances)
const attrs = factory.raw()
const attrList = factory.count(3).raw()</code></pre>

<h3>Factory States</h3>

<p>States let you define named variations of a factory. They apply additional attribute overrides on top of the base definition.</p>

<pre><code class="language-typescript">// Using an object state
const admin = await new UserFactory()
  .state({ role: 'admin', is_active: true })
  .create()

// Using a function state (dynamic)
const recentUser = await new UserFactory()
  .state((index, fake) =&gt; ({
    created_at: fake.recent(7).toISOString(),
  }))
  .create()

// Chaining multiple states
const superAdmin = await new UserFactory()
  .state({ role: 'admin' })
  .state({ is_active: true })
  .count(3)
  .create()</code></pre>

<div class="note">
  <strong>Note:</strong> Factory methods like <code>state()</code>, <code>count()</code>, and <code>afterCreate()</code> are immutable &mdash; they return a new factory instance. The original factory is never modified, so you can safely reuse a base factory in multiple places.
</div>

<h3>After Create Hooks</h3>

<p>Use <code>afterCreate()</code> to run logic after a model is created. This is useful for setting up relationships or seeding related data.</p>

<pre><code class="language-typescript">const usersWithPosts = await new UserFactory()
  .afterCreate(async (user) =&gt; {
    await new PostFactory()
      .count(5)
      .create({ user_id: user.id })
  })
  .count(10)
  .create()</code></pre>

<h3>Bulk Insert</h3>

<p>For inserting large amounts of data efficiently, use <code>createBulk()</code>. It generates attributes in batches and uses multi-value INSERT statements inside a transaction.</p>

<pre><code class="language-typescript">import { db } from '@mantiq/database'

const factory = new UserFactory()
const inserted = await factory.count(100_000).createBulk(db(), {
  batchSize: 1000,
  onProgress: (done, total) =&gt; {
    console.log(\`Inserted \${done}/\${total}\`)
  },
})</code></pre>

<h2>The Faker Class</h2>

<p>MantiqJS includes a lightweight, zero-dependency fake data generator. It covers common needs without pulling in a heavyweight library.</p>

<h3>Person</h3>

<pre><code class="language-typescript">const fake = new Faker()

fake.firstName()    // "Olivia"
fake.lastName()     // "Chen"
fake.name()         // "Liam Martinez"
fake.username()     // "olivia.chen42"</code></pre>

<h3>Internet</h3>

<pre><code class="language-typescript">fake.email()             // "noah.smith@gmail.com"
fake.email('myco.com')   // "emma.jones@myco.com"
fake.url()               // "https://example.com/forge-bloom"
fake.ip()                // "192.168.1.42"
fake.ipv6()              // "2001:0db8:85a3:0000:..."</code></pre>

<h3>Text</h3>

<pre><code class="language-typescript">fake.word()         // "system"
fake.words(4)       // "build cloud data team"
fake.sentence()     // "The quick system would start every new day."
fake.paragraph()    // Multiple sentences
fake.slug()         // "cloud-data-team"</code></pre>

<h3>Numbers &amp; IDs</h3>

<pre><code class="language-typescript">fake.int(1, 100)       // 42
fake.float(0, 1, 2)    // 0.73
fake.boolean()          // true
fake.boolean(0.8)       // true (80% probability)
fake.uuid()             // "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5"
fake.numericId(8)       // "48291037"</code></pre>

<h3>Date &amp; Time</h3>

<pre><code class="language-typescript">fake.date()                      // Random date between 2020 and now
fake.dateString()                // ISO date string
fake.recent(7)                   // Date within the last 7 days
fake.future(30)                  // Date within the next 30 days</code></pre>

<h3>Location &amp; Company</h3>

<pre><code class="language-typescript">fake.city()           // "Tokyo"
fake.country()        // "Canada"
fake.zipCode()        // "90210"
fake.latitude()       // 34.052234
fake.longitude()      // -118.243685
fake.company()        // "Stark Industries"
fake.jobTitle()       // "Senior Software Engineer"
fake.phone()          // "+14155551234"</code></pre>

<h3>Collections &amp; Picking</h3>

<pre><code class="language-typescript">fake.pick(['red', 'green', 'blue'])           // "green"
fake.pickMultiple(['a', 'b', 'c', 'd'], 2)   // ["c", "a"]
fake.shuffle([1, 2, 3, 4, 5])                // [3, 1, 5, 2, 4]</code></pre>

<h3>Patterns &amp; Utilities</h3>

<pre><code class="language-typescript">fake.fromPattern('###-??-****')  // "482-kz-a7m3"
// # = digit, ? = lowercase letter, * = alphanumeric
fake.hex(16)            // "a3f2b1c4d5e6f708"
fake.alphanumeric(10)   // "kL3mN9pQrS"
fake.hexColor()         // "#3a7bc4"
fake.avatar()           // Placeholder avatar URL
fake.imageUrl(800, 600) // Placeholder image URL</code></pre>

<h3>Deterministic Mode</h3>

<p>Pass a seed to the constructor for deterministic output. This is useful for tests that need consistent data.</p>

<pre><code class="language-typescript">const fake = new Faker(12345)
fake.name()  // Always returns the same name with the same seed</code></pre>

<h3>Unique Values</h3>

<pre><code class="language-typescript">const uniqueEmail = fake.unique('email')
uniqueEmail()  // Guaranteed unique on each call
uniqueEmail()  // Different from the first call</code></pre>

<h2>Using Factories in Seeders</h2>

<p>Combine seeders with factories for powerful, readable seeding:</p>

<pre><code class="language-typescript">import { Seeder } from '@mantiq/database'
import { UserFactory } from '../factories/UserFactory.ts'
import { PostFactory } from '../factories/PostFactory.ts'

export class DatabaseSeeder extends Seeder {
  override async run(): Promise&lt;void&gt; {
    // Create 10 users, each with 5 posts
    const users = await new UserFactory()
      .afterCreate(async (user) =&gt; {
        await new PostFactory()
          .count(5)
          .create({ user_id: user.id })
      })
      .count(10)
      .create()

    // Create a specific admin user
    await new UserFactory()
      .state({ role: 'admin', email: 'admin@example.com' })
      .create()
  }
}</code></pre>

<h2>Using Factories in Tests</h2>

<p>Factories are especially useful in tests for setting up the required database state:</p>

<pre><code class="language-typescript">import { describe, it, expect } from 'bun:test'
import { UserFactory } from '../database/factories/UserFactory.ts'

describe('User API', () =&gt; {
  it('returns the user profile', async () =&gt; {
    const user = await new UserFactory().create({ name: 'Alice' })

    const response = await fetch(\`/api/users/\${user.id}\`)
    const data = await response.json()

    expect(data.name).toBe('Alice')
  })

  it('lists only active users', async () =&gt; {
    await new UserFactory().count(3).state({ is_active: true }).create()
    await new UserFactory().count(2).state({ is_active: false }).create()

    const response = await fetch('/api/users?active=true')
    const data = await response.json()

    expect(data.length).toBe(3)
  })
})</code></pre>
`
}
