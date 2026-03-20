# Contributing

Thanks for your interest in contributing to MantiqJS.

## Setup

```bash
git clone https://github.com/mantiqjs/mantiq.git
cd mantiq
bun install
```

## Development

```bash
# Run all tests
bun test packages/

# Run tests for a specific package
bun test packages/core/

# Typecheck
bun run typecheck
```

## Pull Requests

1. Fork the repo and create your branch from `master`
2. Add tests for any new functionality
3. Ensure the test suite passes
4. Keep PRs focused — one feature or fix per PR

## Code Style

- TypeScript strict mode
- No unnecessary abstractions
- Follow existing patterns in the codebase

## Reporting Bugs

Open an issue at [github.com/mantiqjs/mantiq/issues](https://github.com/mantiqjs/mantiq/issues) with:

- Steps to reproduce
- Expected vs actual behavior
- Bun version and OS
