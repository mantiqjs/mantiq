export default {
  title: 'Controllers',
  content: `
<h2>Introduction</h2>
<p>
  Controllers organize your request-handling logic into classes. Instead of defining all your logic
  as closures in route files, controllers let you group related behavior -- for example, a
  <code>UserController</code> might handle listing users, showing a single user, creating, updating,
  and deleting users. Controllers live in <code>app/Http/Controllers/</code>.
</p>

<h2>Writing Controllers</h2>
<p>
  A controller is a plain TypeScript class with action methods. Each action receives a
  <code>MantiqRequest</code> and returns a <code>Response</code> (or a value that MantiqJS
  automatically converts to a response).
</p>

<pre><code class="language-typescript">// app/Http/Controllers/UserController.ts
import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { User } from '../../Models/User.ts'

export class UserController {
  async index(request: MantiqRequest): Promise&lt;Response&gt; {
    const users = await User.all()
    return MantiqResponse.json({ data: users })
  }

  async show(request: MantiqRequest): Promise&lt;Response&gt; {
    const id = request.param('id')
    const user = await User.find(id)

    if (!user) {
      return MantiqResponse.json({ error: 'User not found' }, 404)
    }

    return MantiqResponse.json({ data: user })
  }

  async store(request: MantiqRequest): Promise&lt;Response&gt; {
    const data = await request.only('name', 'email')
    const user = await User.create(data)
    return MantiqResponse.json({ data: user }, 201)
  }

  async update(request: MantiqRequest): Promise&lt;Response&gt; {
    const id = request.param('id')
    const user = await User.findOrFail(id)
    const data = await request.only('name', 'email')
    await user.update(data)
    return MantiqResponse.json({ data: user })
  }

  async destroy(request: MantiqRequest): Promise&lt;Response&gt; {
    const id = request.param('id')
    await User.destroy(id)
    return MantiqResponse.noContent()
  }
}</code></pre>

<h2>Request Data</h2>
<p>
  Use <code>request.input()</code> to read body data and <code>request.param()</code> to read route
  parameters. The <code>request.only()</code> method extracts specific fields from the request body.
</p>

<pre><code class="language-typescript">async store(request: MantiqRequest): Promise&lt;Response&gt; {
  // Read a single field from the request body
  const name = await request.input('name')
  const email = await request.input('email')

  // Read a route parameter
  const id = request.param('id')

  // Read specific fields from the body
  const data = await request.only('name', 'email', 'password')

  // Read all input data
  const allData = await request.input()

  // ...
}</code></pre>

<h2>Registering Controllers in Routes</h2>
<p>
  Routes reference controllers using a tuple syntax: <code>[ControllerClass, 'methodName']</code>.
  The first element is the class itself (not an instance), and the second is a string naming the
  method to call.
</p>

<pre><code class="language-typescript">import type { Router } from '@mantiq/core'
import { UserController } from '../app/Http/Controllers/UserController.ts'

export default function (router: Router) {
  router.get('/users', [UserController, 'index'])
  router.get('/users/:id', [UserController, 'show'])
  router.post('/users', [UserController, 'store'])
  router.put('/users/:id', [UserController, 'update'])
  router.delete('/users/:id', [UserController, 'destroy'])
}</code></pre>

<p>Controllers are imported by class reference, not by string name. This gives you full type safety and ensures dead code can be tree-shaken.</p>

<h2>Dependency Injection</h2>
<p>
  Controllers are resolved from the IoC container, which means their constructor dependencies are
  automatically injected. This is useful for injecting services, repositories, or configuration.
</p>

<pre><code class="language-typescript">import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { ConfigRepository } from '@mantiq/core'

export class SettingsController {
  constructor(private readonly config: ConfigRepository) {}

  async index(request: MantiqRequest): Promise&lt;Response&gt; {
    return MantiqResponse.json({
      appName: this.config.get('app.name'),
      debug: this.config.get('app.debug'),
    })
  }
}</code></pre>

<p>
  When the router dispatches to <code>[SettingsController, 'index']</code>, the container sees
  that the constructor requires a <code>ConfigRepository</code> and automatically provides it.
  No manual wiring is needed.
</p>

<h2>Action Method Signature</h2>
<p>
  Every controller action receives a single <code>MantiqRequest</code> argument and should
  return a <code>Promise&lt;Response&gt;</code>. The method can be <code>async</code> (recommended)
  or synchronous.
</p>

<pre><code class="language-typescript">// Standard async action
async show(request: MantiqRequest): Promise&lt;Response&gt; {
  const id = request.param('id')
  const post = await Post.find(id)
  return MantiqResponse.json({ data: post })
}

// Synchronous action (works but async is preferred)
health(request: MantiqRequest): Response {
  return MantiqResponse.json({ status: 'ok' })
}</code></pre>

<h3>Return Value Conversion</h3>
<p>
  MantiqJS is flexible about what you return from a controller action. The kernel converts return
  values automatically:
</p>

<ul>
  <li><code>Response</code> instance -- used as-is.</li>
  <li>Plain object or array -- serialized to JSON with a <code>200</code> status.</li>
  <li>String -- sent as HTML with a <code>200</code> status.</li>
  <li><code>null</code> or <code>undefined</code> -- returns <code>204 No Content</code>.</li>
</ul>

<pre><code class="language-typescript">// These are all valid return values:
async index(request: MantiqRequest) {
  return MantiqResponse.json({ users: [] })       // Response object
}

async list(request: MantiqRequest) {
  return { users: [] }                             // Auto-serialized to JSON
}

async greeting(request: MantiqRequest) {
  return '&lt;h1&gt;Hello&lt;/h1&gt;'                          // Sent as HTML
}

async deleteUser(request: MantiqRequest) {
  await User.destroy(request.param('id'))
  return null                                      // 204 No Content
}</code></pre>

<h2>Resource Controllers</h2>
<p>
  A resource controller follows RESTful conventions by implementing a standard set of action methods.
  When paired with <code>router.resource()</code>, a single line of routing code maps to seven routes.
</p>

<pre><code class="language-typescript">// app/Http/Controllers/PostController.ts
import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { Post } from '../../Models/Post.ts'

export class PostController {
  /** GET /posts &mdash; List all posts */
  async index(request: MantiqRequest): Promise&lt;Response&gt; {
    const posts = await Post.all()
    return MantiqResponse.json({ data: posts })
  }

  /** GET /posts/create &mdash; Show the create form */
  async create(request: MantiqRequest): Promise&lt;Response&gt; {
    return MantiqResponse.html('&lt;form&gt;...&lt;/form&gt;')
  }

  /** POST /posts &mdash; Store a new post */
  async store(request: MantiqRequest): Promise&lt;Response&gt; {
    const data = await request.only('title', 'body')
    const post = await Post.create(data)
    return MantiqResponse.json({ data: post }, 201)
  }

  /** GET /posts/:post &mdash; Show a single post */
  async show(request: MantiqRequest): Promise&lt;Response&gt; {
    const post = await Post.find(request.param('post'))
    return MantiqResponse.json({ data: post })
  }

  /** GET /posts/:post/edit &mdash; Show the edit form */
  async edit(request: MantiqRequest): Promise&lt;Response&gt; {
    const post = await Post.find(request.param('post'))
    return MantiqResponse.html(\`&lt;form&gt;...editing \${post.title}...&lt;/form&gt;\`)
  }

  /** PUT/PATCH /posts/:post &mdash; Update an existing post */
  async update(request: MantiqRequest): Promise&lt;Response&gt; {
    const post = await Post.find(request.param('post'))
    const data = await request.only('title', 'body')
    await post.update(data)
    return MantiqResponse.json({ data: post })
  }

  /** DELETE /posts/:post &mdash; Delete a post */
  async destroy(request: MantiqRequest): Promise&lt;Response&gt; {
    await Post.destroy(request.param('post'))
    return MantiqResponse.noContent()
  }
}</code></pre>

<p>Register it in your routes file:</p>

<pre><code class="language-typescript">router.resource('posts', PostController)</code></pre>

<h3>API Resource Controllers</h3>
<p>
  For API controllers, the <code>create</code> and <code>edit</code> actions (which serve HTML forms)
  are unnecessary. Use <code>router.apiResource()</code> to generate only the five API-relevant routes.
</p>

<pre><code class="language-typescript">router.apiResource('posts', PostController)
// Generates: index, store, show, update, destroy</code></pre>

<h2>Organizing Controllers</h2>
<p>
  For larger applications, you may want to organize controllers into subdirectories. Since controllers
  are referenced by class import, you simply adjust the import path.
</p>

<pre><code class="language-typescript">// Subdirectory structure
// app/Http/Controllers/Admin/UserController.ts
// app/Http/Controllers/Admin/SettingsController.ts
// app/Http/Controllers/Api/V1/PostController.ts

import { UserController } from '../app/Http/Controllers/Admin/UserController.ts'
import { PostController } from '../app/Http/Controllers/Api/V1/PostController.ts'

router.group({ prefix: '/admin', middleware: ['auth', 'admin'] }, (router) =&gt; {
  router.get('/users', [UserController, 'index'])
})

router.group({ prefix: '/v1' }, (router) =&gt; {
  router.apiResource('posts', PostController)
})</code></pre>

<h2>Single-Action Controllers</h2>
<p>
  For controllers that handle only one action, you can use a convention where the method name
  matches the action directly. This keeps small, focused handlers from being cluttered with
  unnecessary structure.
</p>

<pre><code class="language-typescript">// app/Http/Controllers/GenerateReportController.ts
export class GenerateReportController {
  async handle(request: MantiqRequest): Promise&lt;Response&gt; {
    const report = await generateMonthlyReport()
    return MantiqResponse.download(
      report.toBuffer(),
      'report.pdf',
      'application/pdf',
    )
  }
}

// In routes:
router.post('/reports/generate', [GenerateReportController, 'handle'])</code></pre>

<p>Controller methods are called with a fresh instance on every request, resolved from the container. Keep controllers stateless &mdash; do not store request-specific data as class properties.</p>
`
}
