---
name: crud
description: Generate a complete CRUD — model, migration, controller, routes, form requests, factory, seeder, tests
user_invocable: true
---

# Full CRUD Generator

Generate all files needed for a complete resource CRUD.

## Arguments

`<ModelName>` — e.g., `Post`, `Article`, `Product`

Optionally include fields: `Post title:string body:text published:boolean`

## Process

### 1. Generate Files Using CLI

Run these commands in order:

```bash
bun mantiq make:model <Name> --migration --factory
bun mantiq make:controller <Name>Controller --resource
bun mantiq make:request Store<Name>Request
bun mantiq make:request Update<Name>Request
bun mantiq make:seeder <Name>Seeder
bun mantiq make:test <Name>
```

### 2. Fill in the Migration

Edit the generated migration file in `database/migrations/`. Add columns based on the provided fields (or sensible defaults):

```typescript
override async up(schema: SchemaBuilder): Promise<void> {
  await schema.create('<table_name>', (t) => {
    t.id()
    // Add columns here based on the provided fields
    t.timestamps()
  })
}
```

- Use `snake_case` plural for table names (`blog_posts`, not `BlogPosts`)
- Always include `t.id()` and `t.timestamps()`
- Add `t.softDeletes()` if the model should support soft deletion

### 3. Fill in the Model

Edit `app/Models/<Name>.ts`:

```typescript
import { Model } from '@mantiq/database'

export class Post extends Model {
  static override table = 'posts'
  static override fillable = ['title', 'body', 'published']
  static override casts = { published: 'boolean' }
}
```

### 4. Fill in the Controller

Edit `app/Http/Controllers/<Name>Controller.ts` with full CRUD methods:
- `index` — list with pagination (`Model.paginate(page, perPage)`)
- `store` — create (validate with `Store<Name>Request`, return 201)
- `show` — find by ID (return 404 if not found)
- `update` — update (validate with `Update<Name>Request`)
- `destroy` — delete (return 204)

Use `MantiqResponse.json()` for all responses.

### 5. Fill in Form Requests

`Store<Name>Request` — all required fields:
```typescript
override rules(): Record<string, string> {
  return { title: 'required|string|max:255', body: 'required' }
}
```

`Update<Name>Request` — same fields but optional where appropriate.

### 6. Add Routes

Add to `routes/api.ts`:
```typescript
router.group({ prefix: '/api', middleware: ['auth'] }, (r) => {
  r.resource('/<plural_name>', <Name>Controller)
})
```

Or for web routes with pages, add to `routes/web.ts`.

### 7. Fill in Factory

Edit `database/factories/<Name>Factory.ts`:
```typescript
override definition(index: number, fake: Faker): Record<string, any> {
  return {
    title: fake.sentence(),
    body: fake.paragraph(),
  }
}
```

### 8. Fill in Seeder

Edit `database/seeders/<Name>Seeder.ts` to use the factory:
```typescript
override async run(): Promise<void> {
  await new <Name>Factory().count(10).create()
}
```

### 9. Fill in Tests

Edit `tests/feature/<name>.test.ts` with CRUD tests:
- Can list resources
- Can create with valid data
- Cannot create with invalid data (422)
- Can update
- Can delete
- Unauthenticated requests return 401

### 10. Run Migration

```bash
bun mantiq migrate
```

### 11. Report

Show a summary of all generated files and their locations.
