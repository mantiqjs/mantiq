export default {
  title: 'Hashing',
  content: `
<h2>Introduction</h2>
<p>MantiqJS provides a clean hashing API in <code>@mantiq/core</code> for securely hashing passwords and other sensitive data. The framework supports <strong>Bcrypt</strong> (default) and <strong>Argon2id</strong> drivers, both powered by Bun's built-in <code>Bun.password</code> API with zero external dependencies.</p>

<h2>Configuration</h2>
<p>Hashing is configured in the <code>hash</code> section of your application config. You can set the default driver and customize parameters for each algorithm:</p>

<pre><code class="language-typescript">// config/hashing.ts
export default {
  driver: 'bcrypt',   // 'bcrypt' | 'argon2id'

  bcrypt: {
    rounds: 10,
  },

  argon2id: {
    memoryCost: 65536,  // 64 MB
    timeCost: 4,
  },
}
</code></pre>

<h2>The hash() and hashCheck() Helpers</h2>
<p>The simplest way to hash and verify values is with the global helpers:</p>

<pre><code class="language-typescript">import { hash, hashCheck } from '@mantiq/core'

// Hash a plain-text value
const hashed = await hash('my-secret-password')
// =&gt; '$2b$10$...' (bcrypt) or '$argon2id$v=19$...' (argon2id)

// Verify a plain-text value against a hash
const isValid = await hashCheck('my-secret-password', hashed)
// =&gt; true

const isInvalid = await hashCheck('wrong-password', hashed)
// =&gt; false
</code></pre>

<p>These helpers resolve the <code>HashManager</code> from the service container and delegate to the configured default driver.</p>

<h2>Bcrypt Driver</h2>
<p>Bcrypt is the default hashing driver. It is well-suited for password hashing and widely supported across platforms.</p>

<pre><code class="language-typescript">import { BcryptHasher } from '@mantiq/core'

// Create a hasher with custom rounds
const hasher = new BcryptHasher({ rounds: 12 })

const hashed = await hasher.make('password')
const valid = await hasher.check('password', hashed) // true

// Check if a hash needs to be re-hashed (e.g., cost changed)
hasher.needsRehash(hashed) // false (still at 12 rounds)
</code></pre>

<h3>Configuring Rounds</h3>
<p>The <code>rounds</code> (cost) parameter controls how computationally expensive the hash is. Higher values make brute-force attacks slower but increase login time. The default is <strong>10</strong>. For most applications, 10-12 is a good balance.</p>

<div class="note">
<p>The <code>needsRehash()</code> method checks whether a stored hash was generated with different parameters than the current configuration. This is useful for gradually upgrading hash strength: re-hash on each successful login if needed.</p>
</div>

<h2>Argon2id Driver</h2>
<p>Argon2id is the winner of the Password Hashing Competition and provides stronger resistance against GPU-based attacks and side-channel attacks compared to bcrypt.</p>

<pre><code class="language-typescript">import { Argon2Hasher } from '@mantiq/core'

const hasher = new Argon2Hasher({
  memoryCost: 65536,  // 64 MB of memory
  timeCost: 4,        // number of iterations
})

const hashed = await hasher.make('password')
const valid = await hasher.check('password', hashed) // true
</code></pre>

<h3>Configuring Argon2id Parameters</h3>
<table>
  <thead>
    <tr><th>Parameter</th><th>Default</th><th>Description</th></tr>
  </thead>
  <tbody>
    <tr><td><code>memoryCost</code></td><td>65536 (64 MB)</td><td>Amount of memory in KiB. Higher values resist GPU attacks.</td></tr>
    <tr><td><code>timeCost</code></td><td>4</td><td>Number of iterations. Higher values increase CPU time.</td></tr>
  </tbody>
</table>

<h2>The Hasher Contract</h2>
<p>Both drivers implement the <code>Hasher</code> interface, which defines three methods:</p>

<pre><code class="language-typescript">interface Hasher {
  // Hash a plain-text value
  make(value: string): Promise&lt;string&gt;

  // Check a plain-text value against a hash
  check(value: string, hashedValue: string): Promise&lt;boolean&gt;

  // Check if the hash needs to be re-generated
  needsRehash(hashedValue: string): boolean
}
</code></pre>

<h2>HashManager</h2>
<p>The <code>HashManager</code> is a driver manager that selects the correct hasher based on configuration. It is registered as a singleton in the service container and used by the <code>hash()</code> and <code>hashCheck()</code> helpers.</p>

<pre><code class="language-typescript">import { HashManager } from '@mantiq/core'

const manager = app().make(HashManager)

// Use the default driver
await manager.make('password')

// Use a specific driver
await manager.driver('argon2id').make('password')
</code></pre>

<h2>Usage in Registration and Login Flows</h2>
<p>Here is how hashing fits into a typical authentication flow:</p>

<h3>Registration</h3>
<pre><code class="language-typescript">import { hash } from '@mantiq/core'

class RegisterController {
  async store(request: MantiqRequest) {
    const data = await request.input()

    const user = await User.create({
      name: data.name,
      email: data.email,
      password: await hash(data.password),
    })

    await auth().login(user)
    return MantiqResponse.redirect('/dashboard')
  }
}
</code></pre>

<h3>Login</h3>
<pre><code class="language-typescript">import { hashCheck } from '@mantiq/core'

// Manual credential verification (the auth() helper does this automatically)
const user = await User.where('email', email).first()

if (user &amp;&amp; await hashCheck(password, user.get('password'))) {
  await auth().login(user)
}
</code></pre>

<div class="note">
<p>In practice, you should use <code>auth().attempt()</code> instead of manual hash checking. The attempt method handles credential retrieval, password verification, and automatic re-hashing if the hash parameters have changed.</p>
</div>

<h2>Switching Drivers</h2>
<p>To switch from bcrypt to argon2id, update your config:</p>

<pre><code class="language-typescript">export default {
  driver: 'argon2id',
  argon2id: {
    memoryCost: 65536,
    timeCost: 4,
  },
}
</code></pre>

<p>Existing bcrypt hashes remain valid: <code>hashCheck()</code> detects the algorithm from the hash prefix (<code>$2b$</code> for bcrypt, <code>$argon2id$</code> for argon2id). New hashes will use argon2id, and the <code>needsRehash()</code> method will flag old bcrypt hashes for re-hashing on the next successful login.</p>
`
}
