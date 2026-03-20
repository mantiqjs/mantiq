<p align="center">
  <strong>mantiq</strong>
  <br>
  <em>A batteries-included TypeScript framework for Bun.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/org/mantiq"><img src="https://img.shields.io/npm/v/@mantiq/core?label=core&color=10b981&style=flat-square" alt="npm"></a>
  <a href="https://github.com/mantiqjs/mantiq/blob/master/LICENSE"><img src="https://img.shields.io/github/license/mantiqjs/mantiq?style=flat-square&color=27272a" alt="license"></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-bun%20%3E%3D1.1-f9fafb?style=flat-square" alt="bun"></a>
</p>

---

## Quick Start

```bash
bun create mantiq my-app
cd my-app
bun mantiq migrate
bun run dev
```

With a frontend kit:

```bash
bun create mantiq my-app --kit=react   # or vue, svelte
```

Visit `localhost:3000` — you're running.

---

## Packages

MantiqJS is a modular monorepo. Install what you need, or use `create-mantiq` to get everything wired up.

| | Package | What it does |
|---|---|---|
| **Core** | `@mantiq/core` | Container, router, middleware, HTTP kernel, config, encryption, hashing, cache, sessions |
| **Database** | `@mantiq/database` | Query builder, Eloquent-style ORM, migrations, seeders, factories — SQLite, Postgres, MySQL, MongoDB |
| **Auth** | `@mantiq/auth` | Session & token guards, user providers, auth middleware |
| **CLI** | `@mantiq/cli` | Command kernel, 17 generators, migrations, REPL, route listing |
| **Validation** | `@mantiq/validation` | Rule engine, 40+ built-in rules, FormRequest |
| **Helpers** | `@mantiq/helpers` | `Str`, `Arr`, `Num`, `Collection`, HTTP client, async utilities |
| **Filesystem** | `@mantiq/filesystem` | Local, S3, GCS, Azure Blob, FTP, SFTP |
| **Logging** | `@mantiq/logging` | Console, file, daily rotation, stack channels |
| **Events** | `@mantiq/events` | Dispatcher, broadcasting, model observers |
| **Queue** | `@mantiq/queue` | Jobs, chains, batches, scheduling — sync, SQLite, Redis, SQS, Kafka |
| **Realtime** | `@mantiq/realtime` | WebSocket server, SSE, pub/sub channels |
| **Heartbeat** | `@mantiq/heartbeat` | APM dashboard, request/query/exception tracing at `/_heartbeat` |
| **Vite** | `@mantiq/vite` | Vite integration, SSR, static files |
| **Scaffold** | `create-mantiq` | `bun create mantiq` — project scaffolding |

---

## Usage

### Routing

```typescript
// routes/web.ts
export default function (router: Router) {
  router.get('/', [HomeController, 'index'])
  router.post('/users', [UserController, 'store']).middleware('auth')

  router.resource('/posts', PostController)
}
```

### Models

```typescript
import { Model } from '@mantiq/database'

export class Post extends Model {
  static table = 'posts'
  static fillable = ['title', 'body', 'author_id']
  static hidden = ['deleted_at']
  static casts = { published: 'boolean', meta: 'json' }
}

// Query
const posts = await Post.where('published', true).with('author').paginate(1, 20)
const post = await Post.findOrFail(1)
await Post.create({ title: 'Hello', body: '...', author_id: 1 })
```

### Middleware

```typescript
import type { Middleware, MantiqRequest, NextFunction } from '@mantiq/core'

export class RateLimit implements Middleware {
  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    // before
    const response = await next()
    // after
    return response
  }
}
```

### CLI Commands

```bash
bun mantiq make:model Post --migration
bun mantiq make:controller PostController
bun mantiq make:middleware RateLimit
bun mantiq migrate
bun mantiq seed
bun mantiq route:list
bun mantiq tinker
bun mantiq about
```

### Jobs & Queues

```typescript
import { Job, dispatch } from '@mantiq/queue'

class SendWelcomeEmail extends Job {
  constructor(private userId: number) { super() }

  async handle() {
    const user = await User.findOrFail(this.userId)
    // send email...
  }
}

await dispatch(new SendWelcomeEmail(user.id)).onQueue('emails')
```

### Events

```typescript
import { Dispatcher } from '@mantiq/events'

const events = new Dispatcher()

events.listen('user.registered', async (user) => {
  await dispatch(new SendWelcomeEmail(user.id))
})

events.dispatch('user.registered', newUser)
```

### Validation

```typescript
import { Validator } from '@mantiq/validation'

const v = new Validator(request.all(), {
  name: 'required|string|min:2',
  email: 'required|email|unique:users',
  password: 'required|min:8',
})

if (v.fails()) return MantiqResponse.json({ errors: v.errors() }, 422)
```

---

## Project Structure

```
my-app/
├── app/
│   ├── Http/Controllers/
│   ├── Http/Middleware/
│   ├── Models/
│   └── Providers/
├── config/
├── database/
│   ├── migrations/
│   ├── seeders/
│   └── factories/
├── routes/
│   ├── web.ts
│   └── api.ts
├── storage/
├── index.ts          # app bootstrap
└── mantiq.ts         # CLI entry
```

---

## Development

```bash
git clone https://github.com/mantiqjs/mantiq.git
cd mantiq
bun install
bun test packages/
```

---

## License

MIT — see [LICENSE](LICENSE).
