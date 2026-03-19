export default {
  title: 'Encryption',
  content: `
<h2>Introduction</h2>
<p>MantiqJS provides AES-based symmetric encryption through the <code>@mantiq/core</code> package. The encryption system is used to protect cookies, session data, and any other sensitive values that must be stored or transmitted securely. All encryption is performed using the Web Crypto API built into Bun.</p>

<h2>Configuration</h2>
<p>Encryption requires an <code>APP_KEY</code> environment variable. This key is used for all encrypt/decrypt operations and must be kept secret.</p>

<pre><code class="language-bash"># .env
APP_KEY=base64:K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=
</code></pre>

<p>The key should be a base64-encoded 256-bit (32-byte) value, prefixed with <code>base64:</code>. You can generate one with:</p>

<pre><code class="language-bash">bun mantiq key:generate
</code></pre>

<div class="warning">
<p>If <code>APP_KEY</code> is missing or invalid, the framework will throw a <code>MissingAppKeyError</code> when any encryption operation is attempted. Never commit your <code>APP_KEY</code> to version control.</p>
</div>

<h2>The encrypt() and decrypt() Helpers</h2>
<p>The simplest way to encrypt and decrypt data is with the global helpers:</p>

<pre><code class="language-typescript">import { encrypt, decrypt } from '@mantiq/core'

// Encrypt a string value
const encrypted = await encrypt('sensitive data')
// =&gt; 'eyJpdiI6Ii4uLiIsInZhbHVlIjoiLi4uIiwibWFjIjoiLi4uIn0='

// Decrypt back to the original value
const decrypted = await decrypt(encrypted)
// =&gt; 'sensitive data'
</code></pre>

<p>These helpers resolve the <code>Encrypter</code> from the service container and delegate to the configured implementation.</p>

<h2>The Encrypter Contract</h2>
<p>The encryption system implements the <code>Encrypter</code> interface:</p>

<pre><code class="language-typescript">interface Encrypter {
  // Encrypt a string value
  encrypt(value: string): Promise&lt;string&gt;

  // Decrypt a string value
  decrypt(encrypted: string): Promise&lt;string&gt;

  // Encrypt an arbitrary value (serialized as JSON)
  encryptObject(value: unknown): Promise&lt;string&gt;

  // Decrypt and deserialize a JSON value
  decryptObject&lt;T = unknown&gt;(encrypted: string): Promise&lt;T&gt;

  // Get the encryption key
  getKey(): CryptoKey | ArrayBuffer
}
</code></pre>

<h3>Encrypting Objects</h3>
<p>When you need to encrypt structured data (objects, arrays, numbers), use <code>encryptObject()</code> and <code>decryptObject()</code>. These methods serialize the value as JSON before encryption and deserialize after decryption:</p>

<pre><code class="language-typescript">const encrypter = app().make(Encrypter)

const encrypted = await encrypter.encryptObject({
  userId: 42,
  permissions: ['read', 'write'],
})

const data = await encrypter.decryptObject&lt;{
  userId: number
  permissions: string[]
}&gt;(encrypted)
// =&gt; { userId: 42, permissions: ['read', 'write'] }
</code></pre>

<h2>Error Handling</h2>
<p>The encryption system throws specific errors for different failure modes:</p>

<pre><code class="language-typescript">import { EncryptionError, DecryptionError, MissingAppKeyError } from '@mantiq/core'

try {
  await decrypt(tamperedPayload)
} catch (error) {
  if (error instanceof DecryptionError) {
    // The payload was tampered with, corrupted, or encrypted with a different key
  }
}
</code></pre>

<table>
  <thead>
    <tr><th>Error</th><th>When Thrown</th></tr>
  </thead>
  <tbody>
    <tr><td><code>MissingAppKeyError</code></td><td>APP_KEY is not set or is invalid</td></tr>
    <tr><td><code>EncryptionError</code></td><td>Encryption failed (algorithm error, invalid key)</td></tr>
    <tr><td><code>DecryptionError</code></td><td>Decryption failed (tampered payload, wrong key, corrupted data)</td></tr>
  </tbody>
</table>

<h2>EncryptCookies Middleware</h2>
<p>The <code>EncryptCookies</code> middleware automatically encrypts all outgoing cookies and decrypts incoming cookies. This is included in the default middleware stack, so cookies are encrypted transparently.</p>

<pre><code class="language-typescript">// Cookies are automatically encrypted before being sent to the client
response.cookie('preferences', JSON.stringify({ theme: 'dark' }))
// The client receives: preferences=eyJpdiI6Ii4uLiIs...

// And automatically decrypted when read from the request
const prefs = request.cookie('preferences')
// =&gt; '{"theme":"dark"}'
</code></pre>

<p>If you need to exclude certain cookies from encryption (e.g., third-party tracking cookies), you can customize the middleware's exclusion list.</p>

<h2>Encrypted Sessions</h2>
<p>When using the cookie session driver, session data is encrypted before being stored in the cookie. This prevents users from reading or tampering with their session data, even though it lives on the client.</p>

<div class="note">
<p>The file and memory session drivers store data server-side and do not require encryption of the session payload itself. However, the session ID cookie is always encrypted by the <code>EncryptCookies</code> middleware.</p>
</div>

<h2>Key Rotation</h2>
<p>If you need to rotate your <code>APP_KEY</code>, be aware that any data encrypted with the old key will become unreadable. This includes:</p>
<ul>
  <li>Encrypted cookies (users will be logged out)</li>
  <li>Encrypted session data (sessions will be invalidated)</li>
  <li>Any values you have encrypted and stored in the database</li>
</ul>

<div class="warning">
<p>Plan key rotations carefully. For database-stored encrypted values, you will need to decrypt with the old key and re-encrypt with the new key during a migration.</p>
</div>

<h2>Security Details</h2>
<p>The encryption implementation uses AES-256 (via the Web Crypto API) with the following properties:</p>
<ul>
  <li>A unique initialization vector (IV) is generated for every encryption operation</li>
  <li>The encrypted payload includes a message authentication code (MAC) to detect tampering</li>
  <li>The output is base64-encoded for safe storage and transmission</li>
  <li>Decryption verifies the MAC before attempting to decrypt, preventing padding oracle attacks</li>
</ul>
`
}
