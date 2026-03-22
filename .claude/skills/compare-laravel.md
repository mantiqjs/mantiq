---
name: compare-laravel
description: Compare MantiqJS implementation against Laravel for feature parity and DX gaps
user_invocable: true
---

# Laravel Comparison

Compare MantiqJS against Laravel to identify missing features, DX gaps, and areas where we diverge.

## Arguments

- No args: full comparison
- `<area>`: specific area (e.g., `auth`, `database`, `routing`, `middleware`, `testing`, `cli`)

## Process

### 1. Feature Matrix

For the specified area (or all), compare:

| Feature | Laravel | MantiqJS | Gap |
|---------|---------|----------|-----|
| Feature name | How Laravel does it | How we do it (or "missing") | What's needed |

### 2. DX Comparison

For common tasks, compare the code a developer writes:

**Example: Create a user**
```php
// Laravel
$user = User::create(['name' => 'Ali', 'email' => 'ali@test.com', 'password' => Hash::make('secret')]);
```
```typescript
// MantiqJS
const user = await User.create({ name: 'Ali', email: 'ali@test.com', password: await hash('secret') })
```

Identify where MantiqJS is more verbose, less intuitive, or missing syntactic sugar.

### 3. Convention Gaps

Check if MantiqJS follows Laravel conventions for:
- File/directory structure
- Naming (PascalCase models, snake_case tables, camelCase methods)
- Config file structure
- Artisan/CLI command names
- Error messages and codes

### 4. Report

For each gap found:
- **Priority**: P0 (blocking), P1 (important), P2 (nice-to-have)
- **Effort**: S (small), M (medium), L (large)
- **Impact**: How many developers this affects

End with prioritized action items.
