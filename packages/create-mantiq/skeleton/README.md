# MantiqJS Skeleton

The official MantiqJS application skeleton — API-only, no frontend framework.

This is the reference implementation used by `create-mantiq` to scaffold new projects.

## Getting Started

```bash
bun install
bun mantiq migrate
bun run dev
```

## Structure

```
├── app/
│   ├── Http/Controllers/    # Request handlers
│   ├── Models/              # Database models
│   └── Providers/           # Service providers
├── config/                  # Configuration files
├── database/
│   ├── migrations/          # Database migrations
│   ├── seeders/             # Data seeders
│   └── factories/           # Model factories
├── routes/
│   ├── web.ts               # Web routes
│   └── api.ts               # API routes
├── storage/                 # Logs, cache, uploads
├── index.ts                 # Application bootstrap
├── mantiq.ts                # CLI entry point
└── package.json
```

## Available Commands

```bash
bun run dev              # Start dev server (with watch)
bun run start            # Start production server
bun mantiq migrate       # Run migrations
bun mantiq seed          # Run seeders
bun mantiq make:model    # Generate a model
bun mantiq make:migration # Generate a migration
bun mantiq route:list    # List all routes
```
