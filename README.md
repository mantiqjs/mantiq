# MantiqJS

A batteries-included TypeScript web framework for [Bun](https://bun.sh). Inspired by Laravel, built for the modern JavaScript runtime.

## Packages

| Package | Description |
|---------|-------------|
| [@mantiq/core](packages/core) | Service container, router, middleware, HTTP kernel, config, encryption, hashing, caching, sessions |
| [@mantiq/database](packages/database) | Query builder, ORM, schema migrations, seeders, factories — SQLite, Postgres, MySQL, MongoDB |
| [@mantiq/auth](packages/auth) | Session & token authentication, guards, providers, middleware |
| [@mantiq/cli](packages/cli) | Command kernel, code generators, database commands, REPL (tinker), route listing |
| [@mantiq/validation](packages/validation) | Rule engine, 40+ built-in rules, FormRequest base class |
| [@mantiq/helpers](packages/helpers) | Str, Arr, Num, Collection, HTTP client, async utilities |
| [@mantiq/filesystem](packages/filesystem) | Local, S3, GCS, Azure Blob, FTP, SFTP drivers |
| [@mantiq/logging](packages/logging) | Channel-based logging — console, file, daily rotation, stack |
| [@mantiq/events](packages/events) | Event dispatcher, broadcasting, model observers |
| [@mantiq/queue](packages/queue) | Job dispatching, chains, batches, scheduling — sync, SQLite, Redis, SQS, Kafka |
| [@mantiq/realtime](packages/realtime) | WebSocket server, SSE, channels (public/private/presence), broadcasting |
| [@mantiq/heartbeat](packages/heartbeat) | Observability, APM, request/query/exception tracing, dashboard at `/_heartbeat` |
| [@mantiq/vite](packages/vite) | Vite dev server integration, SSR support, static file serving |
| [create-mantiq](packages/create-mantiq) | CLI scaffolding tool — `bun create mantiq my-app` |

## Quick Start

```bash
bun create mantiq my-app
cd my-app
bun mantiq migrate
bun run dev
```

With a frontend starter kit:

```bash
bun create mantiq my-app --kit=react
bun create mantiq my-app --kit=vue
bun create mantiq my-app --kit=svelte
```

## Requirements

- [Bun](https://bun.sh) >= 1.1.0

## Development

```bash
# Install dependencies
bun install

# Run all tests
bun test packages/

# Typecheck
bun run typecheck
```

## License

MIT
