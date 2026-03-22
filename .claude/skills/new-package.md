---
name: new-package
description: Scaffold a new @mantiq/* package with all conventions
user_invocable: true
---

# New Package Scaffolder

Create a new `@mantiq/*` package following all project conventions.

## Arguments

Required: package name (e.g., `cache`, `rate-limit`, `panel`)

## Process

### 1. Create Directory Structure

```
packages/<name>/
├── src/
│   ├── index.ts              # Public exports
│   ├── <Name>ServiceProvider.ts  # Service provider (if applicable)
│   └── contracts/             # Interfaces
├── tests/
│   └── unit/
│       └── <name>.test.ts     # Basic test file
├── package.json
├── tsconfig.json
└── README.md                  # Only if user requests
```

### 2. package.json

```json
{
  "name": "@mantiq/<name>",
  "version": "<current unified version from root package.json>",
  "description": "<ask user>",
  "type": "module",
  "license": "MIT",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "files": ["src/", "README.md"],
  "mantiq": { "provider": "<Name>ServiceProvider" },
  "peerDependencies": { "@mantiq/core": "^0.5.0" }
}
```

### 3. Service Provider

Use `override` keyword on all overridden methods (per project convention `noImplicitOverride`).

### 4. Register in Workspace

Add to root `package.json` workspaces if not already using `packages/*` glob.

### 5. Add to Publish Script

Verify the package name is included in the publish loop in `/publish` skill and any CI publish steps.

### 6. Verify

- Run `bun install` to link the new package
- Run typecheck to ensure no errors
- Run the basic test
