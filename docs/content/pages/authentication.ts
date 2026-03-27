export default {
  title: 'Authentication',
  content: `
<h2>Introduction</h2>
<p>The <code>@mantiq/auth</code> package provides a complete session-based authentication system. It includes guards for resolving the authenticated user, user providers for retrieving users from the database, middleware for protecting routes, and helpers for logging in and out. The architecture is driver-based, allowing you to swap or extend any component.</p>

<h2>Configuration</h2>
<p>Authentication is configured in <code>config/auth.ts</code>. This file defines guards, user providers, and which guard is the default:</p>

<pre><code class="language-typescript">import { User } from '../app/Models/User.ts'

export default {
  defaults: {
    guard: 'web',
  },

  guards: {
    web: {
      driver: 'session',
      provider: 'users',
    },
  },

  providers: {
    users: {
      driver: 'database',
      model: User,
    },
  },
}
</code></pre>

<h3>Guards</h3>
<p>A guard defines <em>how</em> users are authenticated for each request. The built-in <code>session</code> driver uses server-side sessions to maintain state between requests.</p>

<h3>User Providers</h3>
<p>A user provider defines <em>how</em> users are retrieved from storage. The <code>database</code> provider uses the model class to look up users by their credentials.</p>

<h2>The User Model</h2>
<p>Your User model should use the <code>AuthenticatableModel</code> mixin from <code>@mantiq/auth</code>. This mixin provides default implementations for all authentication methods using conventional column names (<code>id</code>, <code>password</code>, <code>remember_token</code>):</p>

<pre><code class="language-typescript">import { AuthenticatableModel } from '@mantiq/auth'
import { Model } from '@mantiq/database'

export class User extends AuthenticatableModel(Model) {
  static override fillable = ['name', 'email', 'password']
  static override hidden = ['password', 'remember_token']
}
</code></pre>

<p>The mixin automatically provides:</p>
<ul>
  <li><code>getAuthIdentifierName()</code> &mdash; returns <code>'id'</code></li>
  <li><code>getAuthIdentifier()</code> &mdash; returns the user's primary key value</li>
  <li><code>getAuthPasswordName()</code> &mdash; returns <code>'password'</code></li>
  <li><code>getAuthPassword()</code> &mdash; returns the hashed password</li>
  <li><code>getRememberToken()</code> / <code>setRememberToken()</code> &mdash; manages the remember me token</li>
  <li><code>createToken()</code>, <code>tokenCan()</code>, <code>tokenCant()</code> &mdash; API token methods</li>
</ul>

<p>You do not need to manually implement the <code>Authenticatable</code> interface when using this mixin.</p>

<h2>The auth() Helper</h2>
<p>The <code>auth()</code> helper provides access to the authentication manager from anywhere in your application. The manager must have the current request set before use:</p>

<pre><code class="language-typescript">import { auth } from '@mantiq/auth'

// Get the auth manager
const manager = auth()

// Set the current request (done automatically by the auth middleware)
manager.setRequest(request)
</code></pre>

<h3>Checking Authentication Status</h3>

<pre><code class="language-typescript">// Check if a user is currently authenticated
if (await auth().check()) {
  // User is logged in
}

// Check if the user is a guest (not authenticated)
if (await auth().guest()) {
  // User is not logged in
}

// Get the currently authenticated user
const user = await auth().user()  // Authenticatable | null

// Get the authenticated user's ID
const id = await auth().id()  // string | number | null
</code></pre>

<h3>Logging In</h3>

<pre><code class="language-typescript">// Set the request on the auth manager first
const manager = auth()
manager.setRequest(request)

// Attempt login with credentials &mdash; returns true on success
const success = await manager.attempt(
  { email: 'alice@example.com', password: 'secret' },
  true  // remember me (optional, default: false)
)

// Login a specific user instance directly
await manager.login(user)
await manager.login(user, true)  // with remember me

// Login by user ID
const user = await manager.loginUsingId(1)
</code></pre>

<p>The <code>attempt()</code> method retrieves the user by the non-password credentials, verifies the password using the configured hasher, and automatically re-hashes it if the hash parameters have changed.</p>

<h3>Logging Out</h3>

<pre><code class="language-typescript">await auth().logout()
</code></pre>

<p>Logging out clears the session, invalidates the session ID to prevent fixation attacks, cycles the remember token, and flags the remember cookie for clearing.</p>

<h2>Middleware</h2>

<h3>Authenticate (Protecting Routes)</h3>
<p>The <code>Authenticate</code> middleware ensures that only authenticated users can access a route. Unauthenticated users receive a 401 response (or are redirected if configured):</p>

<pre><code class="language-typescript">// In your route definitions
router.group({ middleware: ['auth'] }, (router) =&gt; {
  router.get('/dashboard', [DashboardController, 'index'])
  router.get('/profile', [ProfileController, 'show'])
})
</code></pre>

<h3>RedirectIfAuthenticated (Guest Routes)</h3>
<p>The <code>RedirectIfAuthenticated</code> middleware prevents authenticated users from accessing guest-only pages like login and registration forms:</p>

<pre><code class="language-typescript">router.group({ middleware: ['guest'] }, (router) =&gt; {
  router.get('/login', [AuthController, 'showLogin'])
  router.post('/login', [AuthController, 'login'])
  router.get('/register', [AuthController, 'showRegister'])
  router.post('/register', [AuthController, 'register'])
})
</code></pre>

<h2>Session Guard Details</h2>
<p>The <code>SessionGuard</code> is the default guard. It resolves users through the following process on each request:</p>

<ol>
  <li>Check if a user ID exists in the session (stored during <code>login()</code>)</li>
  <li>If found, retrieve the user from the database via the user provider</li>
  <li>If not found in the session, attempt to recall from the remember me cookie</li>
  <li>If recalled, re-store the user ID in the session for subsequent requests</li>
</ol>

<h2>Remember Me</h2>
<p>When <code>remember</code> is set to <code>true</code> during login, a long-lived remember cookie is set on the client. If the session expires but the remember cookie is still valid, the user is automatically re-authenticated.</p>

<p>The remember cookie format is <code>userId|rememberToken|passwordHash</code>. The password hash acts as a tamper-detection mechanism: if the user changes their password, all existing remember cookies are invalidated.</p>

<pre><code class="language-typescript">// Login with remember me
await auth().attempt(credentials, true)

// Check if the user was authenticated via remember cookie
if (auth().viaRemember()) {
  // User was recalled from remember cookie, not session
}
</code></pre>

<h2>Session Fixation Prevention</h2>
<p>The <code>SessionGuard</code> automatically regenerates the session ID upon login. This prevents session fixation attacks where an attacker sets a known session ID and waits for the victim to log in with it.</p>

<pre><code class="language-typescript">// This happens automatically inside auth().login():
await request.session().regenerate(true)  // destroy old session, create new ID
</code></pre>

<h2>Database User Provider</h2>
<p>The <code>DatabaseUserProvider</code> implements the <code>UserProvider</code> contract using your model class. It provides:</p>
<ul>
  <li><code>retrieveById(id)</code> &mdash; Fetch a user by primary key</li>
  <li><code>retrieveByCredentials(credentials)</code> &mdash; Fetch by non-password fields (e.g., email)</li>
  <li><code>validateCredentials(user, credentials)</code> &mdash; Hash-check the password</li>
  <li><code>retrieveByToken(id, token)</code> &mdash; Fetch by ID and remember token</li>
  <li><code>updateRememberToken(user, token)</code> &mdash; Persist a new remember token</li>
  <li><code>rehashPasswordIfRequired(user, credentials)</code> &mdash; Re-hash if cost parameters changed</li>
</ul>

<h2>Implementing a Login Controller</h2>
<p>Here is a complete example of a login controller:</p>

<pre><code class="language-typescript">import { auth } from '@mantiq/auth'
import { MantiqResponse } from '@mantiq/core'
import type { MantiqRequest } from '@mantiq/core'

export class AuthController {
  async login(request: MantiqRequest) {
    const email = await request.input('email')
    const password = await request.input('password')
    const remember = await request.input('remember', false)

    const manager = auth()
    manager.setRequest(request)

    const success = await manager.attempt({ email, password }, remember)

    if (!success) {
      return MantiqResponse.json(
        { error: 'Invalid credentials' },
        401
      )
    }

    return MantiqResponse.redirect('/dashboard')
  }

  async logout(request: MantiqRequest) {
    const manager = auth()
    manager.setRequest(request)
    await manager.logout()
    return MantiqResponse.redirect('/login')
  }

  async user(request: MantiqRequest) {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()

    if (!user) {
      return MantiqResponse.json({ error: 'Not authenticated' }, 401)
    }

    return MantiqResponse.json({ data: user })
  }
}
</code></pre>
`
}
