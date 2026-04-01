---
description: MantiqJS code patterns — routing, responses, validation, testing
---

# Code Patterns

## Routing

Route files export a default function:

```typescript
import type { Router } from '@mantiq/core'

export default function (router: Router) {
  router.get('/posts', [PostController, 'index'])
  router.post('/posts', [PostController, 'store'])
  router.get('/posts/:id', [PostController, 'show']).whereNumber('id')

  router.group({ prefix: '/admin', middleware: ['auth'] }, (r) => {
    r.resource('/users', UserController)
  })
}
```

## Responses

```typescript
return MantiqResponse.json({ data: users })          // 200
return MantiqResponse.json({ data: post }, 201)       // 201 Created
return MantiqResponse.noContent()                      // 204
return MantiqResponse.redirect('/login')               // 302
```

## Validation Rules

```typescript
override rules(): Record<string, string> {
  return {
    name: 'required|string|max:255',
    email: 'required|email|unique:users,email',
    password: 'required|min:8|confirmed',
    age: 'integer|min:18|max:120',
  }
}
```

## Service Container

Use class keys, NOT strings:

```typescript
import { CacheManager } from '@mantiq/core'

app.make(CacheManager)   // correct — use the class itself as key
app.make('cache')         // WRONG — string keys will throw
```

Helper functions are available for common services:

```typescript
import { cache, config, env } from '@mantiq/core'

await cache().get('key')           // CacheManager
config('database.connection')       // ConfigRepository
env('APP_KEY')                      // environment variable
```

## Config Files

```typescript
import { env } from '@mantiq/core'

export default {
  name: env('APP_NAME', 'MantiqJS'),
  debug: env('APP_DEBUG', false),
}
```

## Testing

```typescript
import { describe, test, expect } from 'bun:test'
import { TestCase } from '@mantiq/testing'

const t = new TestCase()
t.refreshDatabase = true
t.setup()

describe('Posts', () => {
  test('can list posts', async () => {
    await t.client.initSession()
    const res = await t.client.get('/api/posts')
    res.assertOk()
  })
})
```

- Call `t.client.initSession()` before POST/PUT/DELETE (gets CSRF token)
- Assertions: `assertOk()`, `assertCreated()`, `assertStatus(n)`, `assertJsonPath()`
- Database: `assertDatabaseHas('table', { key: 'value' })`

## Don'ts

- Don't use `(faker)` for Factory.definition — it's `(index: number, fake: Faker)`
- Don't pass arguments to `next()` in middleware — NextFunction takes none
- Don't use string keys with container — use class keys
- Don't use `require()` — ESM only
- Don't use `fs.writeFileSync()` — use `Bun.write()`
- Don't put controllers in `app/Controllers/` — they go in `app/Http/Controllers/`
- Don't default export controllers or models — use named exports
- Don't manually create migration files — use `bun mantiq make:migration`
- Don't use jest or vitest — use `bun:test`
