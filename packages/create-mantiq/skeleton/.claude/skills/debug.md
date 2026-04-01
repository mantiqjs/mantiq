---
name: debug
description: Framework-aware debugging — check routes, middleware, config, database, logs
user_invocable: true
---

# Debug Helper

Systematically diagnose issues in the MantiqJS application.

## Arguments

- No args: run full diagnostic
- `routes`: check route registration
- `db`: check database connection and migrations
- `config`: check configuration

## Step 1: Environment Check

```bash
cat .env | grep -E "APP_ENV|APP_DEBUG|APP_KEY|DB_CONNECTION|SESSION_DRIVER"
```

Verify:
- `APP_KEY` is set (not empty)
- `APP_DEBUG=true` for development
- `DB_CONNECTION` matches available driver

## Step 2: Route Check

```bash
bun mantiq route:list
```

- Verify the route in question is registered
- Check middleware is correct (auth on protected routes, guest on login/register)
- Check HTTP method matches (GET vs POST)

## Step 3: Database Check

```bash
bun mantiq migrate:status
```

- Are all migrations ran?
- If "pending", run `bun mantiq migrate`
- Check if the SQLite file exists: `ls -la database/database.sqlite`

## Step 4: Config Check

Read the relevant config file in `config/`:
- `config/app.ts` — app name, key, debug
- `config/database.ts` — connection settings
- `config/auth.ts` — guards, providers
- `config/session.ts` — driver, lifetime, cookie name

## Step 5: Server Boot Check

```bash
bun run index.ts &
sleep 2
curl -s http://localhost:3000/ -w "\nHTTP %{http_code}"
curl -s http://localhost:3000/api/ping -w "\nHTTP %{http_code}"
kill %1
```

Check for boot errors, port conflicts, 500 errors.

## Report

Summarize: what's working, what's broken, suggested fix with exact commands.
