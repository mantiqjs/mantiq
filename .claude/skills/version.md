---
name: version
description: Show current version, check npm for drift, verify all packages match
user_invocable: true
---

# Version Status

Check version consistency across all packages and npm.

## Process

### 1. Local Versions

Read `package.json` from root and all 20 packages. Flag any that don't match the root version.

### 2. Published Versions

For each package, check what's published on npm:

```bash
npm view @mantiq/<name> version 2>/dev/null
```

And for create-mantiq:

```bash
npm view create-mantiq version 2>/dev/null
```

### 3. Report

Show a table:

| Package | Local | npm latest | Match |
|---------|-------|-----------|-------|
| @mantiq/core | 0.5.12 | 0.5.12 | yes |
| @mantiq/auth | 0.5.12 | 0.5.11 | **NO** |
| ... | ... | ... | ... |

Flag any mismatches. If all match, say "All 20 packages at v<version>, npm in sync."
