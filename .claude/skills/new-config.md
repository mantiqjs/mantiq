---
name: new-config
description: Add a new config file to the skeleton with Laravel-style comment blocks
user_invocable: true
---

# New Config File

Add a new configuration file to the skeleton following project conventions.

## Arguments

Required: config name (e.g., `broadcasting`, `rate-limit`)

## Process

### 1. Create the Config File

Create `packages/create-mantiq/skeleton/config/<name>.ts` with:

- `import { env } from '@mantiq/core'` (if using env vars)
- `export default { ... }`
- Laravel-style comment blocks for each section:

```typescript
export default {

  /*
  |--------------------------------------------------------------------------
  | Section Name
  |--------------------------------------------------------------------------
  |
  | Description of what this section configures.
  |
  | Supported: 'option1', 'option2'
  |
  */
  key: env('ENV_VAR', 'default'),
}
```

### 2. Register in Service Provider (if applicable)

If the config is consumed by a service provider, ensure the provider reads it:
```typescript
const config = configRepo.get('<name>', {})
```

### 3. Add to .env.example

If the config uses env vars, add them to the skeleton's `.env.example` template in `packages/create-mantiq/src/templates.ts`.

### 4. Verify

- Check the skeleton has the file: `ls packages/create-mantiq/skeleton/config/<name>.ts`
- The symlink at `skeleton/` should automatically reflect it
