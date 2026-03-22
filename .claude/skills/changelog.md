---
name: changelog
description: Generate changelog from git history between versions
user_invocable: true
---

# Changelog Generator

Generate a formatted changelog from git history.

## Arguments

- No args: changes since last tag/release
- `<from>..<to>`: specific range (e.g., `0.5.10..0.5.12`)
- `<version>`: changes since that version

## Process

1. Determine the range using `git log --oneline <range>`
2. Categorize commits by conventional commit prefix:
   - `feat:` → Features
   - `fix:` → Bug Fixes
   - `refactor:` → Refactoring
   - `docs:` → Documentation
   - `chore:` → Maintenance
   - `test:` → Tests
3. Format as markdown:

```markdown
## v0.5.12

### Features
- Description (commit hash)

### Bug Fixes
- Description (commit hash)

### Maintenance
- Description (commit hash)
```

4. Output the changelog. If the user says "save", append to CHANGELOG.md.
