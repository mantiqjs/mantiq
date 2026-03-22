---
name: scaffold-test
description: Scaffold a fresh app, run migrations, start server, smoke test, cleanup
user_invocable: true
---

# Scaffold & Smoke Test

Scaffolds a fresh MantiqJS app from the local source, runs migrations, starts the server, runs smoke tests, then cleans up.

## Arguments

- `react` (default), `vue`, `svelte`, or `api-only` (no kit)

## Process

### 1. Scaffold

```bash
export PATH="$HOME/.bun/bin:$PATH"
rm -rf /private/tmp/mantiq-scaffold-test
bun <mantiq-project-root>/packages/create-mantiq/src/index.ts mantiq-scaffold-test --kit=<kit> --yes --no-git
cd /private/tmp/mantiq-scaffold-test
```

If no kit specified or `api-only`, omit the `--kit` flag.

### 2. Migrate

```bash
bun mantiq migrate
```

### 3. Start Server

```bash
bun run index.ts &
```

Wait for "Server running" message (up to 10 seconds).

### 4. Smoke Tests

Run these checks and report pass/fail:

- `GET /` — should return 200
- `GET /api/ping` — should return 200 with JSON `{"status":"ok"}`
- Static assets (if kit): check that CSS/JS files return 200
- CSRF flow (if kit): GET / for cookies → POST /register with XSRF token
- Token auth (if api-only): POST /api/register → returns token → GET /api/user with bearer

### 5. Cleanup

Kill the server process and remove `/private/tmp/mantiq-scaffold-test`.

### 6. Report

Show pass/fail for each smoke test. If any fail, show the HTTP status and response body.
