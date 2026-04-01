---
name: api
description: Add a new API endpoint with controller, validation, and tests
user_invocable: true
---

# Add API Endpoint

Create a new API endpoint with proper controller, validation, and tests.

## Arguments

`<method> <path> [description]` — e.g., `POST /api/orders "Create a new order"`

## Process

### 1. Determine the Controller

- If a matching controller exists (e.g., `OrderController` for `/api/orders`), add the method there
- Otherwise, generate one: `bun mantiq make:controller <Name>Controller`

### 2. Add Controller Method

```typescript
async methodName(request: MantiqRequest): Promise<Response> {
  // Validate if needed
  // Business logic
  return MantiqResponse.json({ data: result })
}
```

- Import `MantiqRequest` as type, `MantiqResponse` as value from `@mantiq/core`
- Use appropriate status codes: 200 (get/update), 201 (create), 204 (delete)
- For validation, create a FormRequest: `bun mantiq make:request <Name>Request`

### 3. Add Route

Edit `routes/api.ts`:

```typescript
router.get('/api/endpoint', [Controller, 'method'])
// Or with middleware:
router.post('/api/endpoint', [Controller, 'method']).middleware('auth')
```

- API routes should be prefixed with `/api/`
- Protected endpoints need `auth` middleware
- Use parameter constraints: `.whereNumber('id')`, `.whereAlpha('slug')`

### 4. Add Validation (if mutating)

For POST/PUT/PATCH endpoints, generate and fill a FormRequest:

```bash
bun mantiq make:request <Name>Request
```

```typescript
override rules(): Record<string, string> {
  return {
    field: 'required|string|max:255',
  }
}
```

### 5. Add Tests

Create or update a test file in `tests/feature/`:

```typescript
import { describe, test, expect } from 'bun:test'
import { TestCase } from '@mantiq/testing'

const t = new TestCase()
t.setup()

describe('Endpoint', () => {
  test('returns expected response', async () => {
    await t.client.initSession()
    const res = await t.client.get('/api/endpoint')
    res.assertOk()
  })
})
```

### 6. Verify

```bash
bun mantiq route:list
bun test tests/feature/<name>.test.ts
```
