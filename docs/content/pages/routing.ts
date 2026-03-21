export default {
  title: 'Routing',
  content: `
<h2>Introduction</h2>
<p>
  Routes define how your application responds to incoming HTTP requests. In MantiqJS, routes are defined
  in two files: <code>routes/web.ts</code> for browser-facing routes and <code>routes/api.ts</code> for
  API endpoints. Both files export a function that receives a <code>Router</code> instance.
</p>

<pre><code class="language-typescript">// routes/web.ts
import type { Router } from '@mantiq/core'
import { HomeController } from '../app/Http/Controllers/HomeController.ts'

export default function (router: Router) {
  router.get('/', [HomeController, 'index'])
}</code></pre>

<pre><code class="language-typescript">// routes/api.ts
import type { Router } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'

export default function (router: Router) {
  router.get('/api/ping', () =&gt; {
    return MantiqResponse.json({ status: 'ok' })
  })
}</code></pre>

<h2>Available HTTP Methods</h2>
<p>
  The router provides methods for every standard HTTP verb. Each method accepts a path string
  and a route action, and returns a chainable <code>RouterRoute</code> object for further configuration.
</p>

<pre><code class="language-typescript">router.get(path, action)       // GET request
router.post(path, action)      // POST request
router.put(path, action)       // PUT request
router.patch(path, action)     // PATCH request
router.delete(path, action)    // DELETE request
router.options(path, action)   // OPTIONS request</code></pre>

<p>
  For routes that need to respond to multiple HTTP methods, use <code>match()</code>. To respond to
  all methods, use <code>any()</code>.
</p>

<pre><code class="language-typescript">// Respond to both PUT and PATCH
router.match(['PUT', 'PATCH'], '/posts/:post', [PostController, 'update'])

// Respond to any HTTP method
router.any('/webhook', [WebhookController, 'handle'])</code></pre>

<h2>Route Actions</h2>
<p>
  A route action defines what happens when the route matches. MantiqJS supports two forms of route actions:
  <strong>controller pairs</strong> and <strong>closures</strong>.
</p>

<h3>Controller Pairs</h3>
<p>
  The recommended approach for non-trivial routes. Pass a tuple of the controller class and the
  method name as a string. The controller is resolved from the IoC container, so constructor
  dependencies are automatically injected.
</p>

<pre><code class="language-typescript">import { UserController } from '../app/Http/Controllers/UserController.ts'

router.get('/users', [UserController, 'index'])
router.get('/users/:id', [UserController, 'show'])
router.post('/users', [UserController, 'store'])</code></pre>

<h3>Closures</h3>
<p>
  For simple routes where a full controller would be overkill, pass a closure (arrow function) directly.
  The closure receives the <code>MantiqRequest</code> object as its only argument.
</p>

<pre><code class="language-typescript">router.get('/health', (request) =&gt; {
  return MantiqResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
})</code></pre>

<p>
  Both controller methods and closures can return a <code>Response</code> object, a plain object (automatically
  serialized as JSON), a string (sent as HTML), or <code>null</code>/<code>undefined</code> (204 No Content).
</p>

<h2>Route Parameters</h2>
<p>
  Route parameters are defined using the <code>:param</code> syntax. When a request matches, the captured
  values are available on the request via <code>request.param(name)</code>.
</p>

<pre><code class="language-typescript">router.get('/users/:id', (request) =&gt; {
  const userId = request.param('id')
  return MantiqResponse.json({ userId })
})

// Multiple parameters
router.get('/posts/:postId/comments/:commentId', (request) =&gt; {
  const postId = request.param('postId')
  const commentId = request.param('commentId')
  // ...
})</code></pre>

<h3>Optional Parameters</h3>
<p>
  Append a <code>?</code> to a parameter name to make it optional. Optional parameters will be
  <code>undefined</code> if not present in the URL.
</p>

<pre><code class="language-typescript">router.get('/users/:id/posts/:slug?', (request) =&gt; {
  const id = request.param('id')
  const slug = request.param('slug') // may be undefined
  // ...
})</code></pre>

<h3>Parameter Constraints</h3>
<p>
  Constrain a parameter to match a specific pattern. If the constraint is not satisfied, the route
  will not match and the router continues checking other routes.
</p>

<pre><code class="language-typescript">// Only match numeric IDs
router.get('/users/:id', [UserController, 'show']).whereNumber('id')

// Only match UUIDs
router.get('/orders/:order', [OrderController, 'show']).whereUuid('order')

// Only match alphabetic slugs
router.get('/categories/:slug', [CategoryController, 'show']).whereAlpha('slug')

// Custom regex constraint
router.get('/files/:path', [FileController, 'show']).where('path', /^[\\w\\-\\/]+$/)</code></pre>

<h2>Named Routes</h2>
<p>
  Named routes let you generate URLs without hardcoding paths. Assign a name using the
  <code>.name()</code> method, then use the <code>route()</code> helper to generate URLs.
</p>

<pre><code class="language-typescript">// Define a named route
router.get('/users/:id', [UserController, 'show']).name('users.show')

// Generate a URL
import { route } from '@mantiq/core'

route('users.show', { id: 42 })           // '/users/42'
route('users.show', { id: 42 }, true)     // 'http://localhost:3000/users/42'</code></pre>

<p>
  Extra parameters that don't correspond to route segments are automatically appended as query string values.
</p>

<pre><code class="language-typescript">route('users.index', { page: 2, sort: 'name' })
// '/users?page=2&amp;sort=name'</code></pre>

<h2>Route Groups</h2>
<p>
  Route groups let you share attributes like prefixes and middleware across multiple routes.
  Groups can be nested, and their options are merged.
</p>

<pre><code class="language-typescript">router.group({ prefix: '/admin', middleware: ['auth', 'admin'] }, (router) =&gt; {
  router.get('/dashboard', [AdminController, 'dashboard']).name('admin.dashboard')
  router.get('/users', [AdminController, 'users']).name('admin.users')
  router.get('/settings', [AdminController, 'settings']).name('admin.settings')
})</code></pre>

<h3>Group Options</h3>
<p>The <code>RouteGroupOptions</code> interface supports these properties:</p>
<ul>
  <li><code>prefix</code> — A path prefix prepended to every route in the group (e.g., <code>'/admin'</code>).</li>
  <li><code>middleware</code> — An array of middleware aliases applied to every route in the group.</li>
  <li><code>as</code> — A name prefix prepended to route names (e.g., <code>'admin.'</code>).</li>
</ul>

<pre><code class="language-typescript">router.group({ prefix: '/api/v2', as: 'api.v2.', middleware: ['throttle:60,1'] }, (router) =&gt; {
  router.get('/users', [ApiUserController, 'index']).name('users.index')
  // Full name: 'api.v2.users.index'
  // Full path: '/api/v2/users'
})</code></pre>

<h3>Nested Groups</h3>
<pre><code class="language-typescript">router.group({ prefix: '/api', middleware: ['api'] }, (router) =&gt; {
  router.group({ prefix: '/v1', as: 'v1.' }, (router) =&gt; {
    router.get('/users', [UserController, 'index']).name('users.index')
  })
})</code></pre>

<h2>Resource Routes</h2>
<p>
  Resource routes generate a complete set of RESTful routes for a controller with a single call.
  This follows convention over configuration: one line replaces seven route definitions.
</p>

<pre><code class="language-typescript">router.resource('photos', PhotoController)</code></pre>

<p>This generates the following routes:</p>

<table>
  <thead>
    <tr><th>Method</th><th>Path</th><th>Action</th><th>Name</th></tr>
  </thead>
  <tbody>
    <tr><td>GET</td><td>/photos</td><td>index</td><td>photos.index</td></tr>
    <tr><td>GET</td><td>/photos/create</td><td>create</td><td>photos.create</td></tr>
    <tr><td>POST</td><td>/photos</td><td>store</td><td>photos.store</td></tr>
    <tr><td>GET</td><td>/photos/:photo</td><td>show</td><td>photos.show</td></tr>
    <tr><td>GET</td><td>/photos/:photo/edit</td><td>edit</td><td>photos.edit</td></tr>
    <tr><td>PUT/PATCH</td><td>/photos/:photo</td><td>update</td><td>photos.update</td></tr>
    <tr><td>DELETE</td><td>/photos/:photo</td><td>destroy</td><td>photos.destroy</td></tr>
  </tbody>
</table>

<h3>API Resources</h3>
<p>
  For APIs, you typically don't need the <code>create</code> and <code>edit</code> actions (those serve
  HTML forms). Use <code>apiResource()</code> to generate only the five API-relevant routes.
</p>

<pre><code class="language-typescript">router.apiResource('posts', PostController)
// Generates: index, store, show, update, destroy (no create or edit)</code></pre>

<p>
  The route parameter name is automatically singularized from the resource name &mdash;
  <code>'photos'</code> becomes <code>:photo</code>, and <code>'categories'</code> becomes <code>:category</code>.
</p>

<h2>Route Middleware</h2>
<p>
  Middleware can be assigned to individual routes or to every route in a group. Pass one or more
  middleware aliases to the <code>.middleware()</code> method.
</p>

<pre><code class="language-typescript">// Single middleware
router.get('/dashboard', [DashboardController, 'index']).middleware('auth')

// Multiple middleware
router.post('/admin/settings', [SettingsController, 'update'])
  .middleware('auth', 'admin')

// Middleware with parameters
router.get('/api/data', [DataController, 'index'])
  .middleware('throttle:60,1')</code></pre>

<h2>Model Binding</h2>
<p>
  Model binding automatically resolves route parameters to model instances. Register bindings
  on the router, and MantiqJS will look up the model before your controller receives the request.
</p>

<pre><code class="language-typescript">// Register a model binding
router.model('user', User)

// Or use a custom resolver
router.bind('user', async (value: string) =&gt; {
  const user = await User.find(Number(value))
  if (!user) throw new NotFoundError('User not found')
  return user
})</code></pre>

<h2>Listing Routes</h2>
<p>
  To inspect all registered routes at runtime, call <code>router.routes()</code>. This returns
  an array of <code>RouteDefinition</code> objects with method, path, action, name, middleware,
  and constraint information.
</p>

<pre><code class="language-typescript">const allRoutes = router.routes()
for (const r of allRoutes) {
  console.log(\`\${r.method} \${r.path} \${r.name ?? '(unnamed)'}\`)
}</code></pre>

<h2>Route Resolution</h2>
<p>
  When a request arrives, the router tries to match it against registered routes for that HTTP method.
  If no route matches, it checks whether the path exists under a different method. If so, a
  <code>405 Method Not Allowed</code> response is returned with the <code>Allow</code> header set.
  If no route matches at all, a <code>404 Not Found</code> error is thrown.
</p>

<p>
  Routes are matched in registration order. If two routes could match the same path, the one
  registered first wins, so place more specific routes before catch-all patterns.
</p>
`
}
