---
name: publish
description: Safe publish process for all MantiqJS packages — typecheck, test, bump, PR, publish, sync
user_invocable: true
---

# MantiqJS Publish Process

You are executing the safe publish process for MantiqJS. Follow every step in order. **Never skip a step.** If any step fails, STOP and report the failure — do not continue to the next step.

## Arguments

The user may provide a version number as an argument (e.g., `/publish 0.5.12`). If no version is provided, read the current version from `package.json` and increment the patch number.

## Pre-flight Checks

Before anything else, verify these conditions. If ANY fail, STOP immediately:

1. **Clean working tree**: Run `git status`. If there are uncommitted changes, STOP and tell the user to commit or stash first. Never publish from a dirty working tree.
2. **Correct branch**: You must be on the `next` branch. If on `master`, switch to `next`. If on any other branch, STOP and ask the user.
3. **Up to date**: Run `git pull origin next` to ensure you have the latest changes.

## Step 1: Typecheck

```bash
export PATH="$HOME/.bun/bin:$PATH" && bun run typecheck
```

If typecheck fails, STOP. Do not proceed. Report which packages have type errors.

## Step 2: Unit Tests

```bash
export PATH="$HOME/.bun/bin:$PATH" && bun test packages/
```

If tests fail (ignoring MSSQL infrastructure-dependent failures), STOP. Report which tests failed.

## Step 3: E2E Tests

```bash
export PATH="$HOME/.bun/bin:$PATH" && npx playwright test e2e/
```

If e2e tests fail, STOP. Report which tests failed.

## Step 4: Bump Version

Determine the version number (from argument or auto-increment), then:

```bash
export PATH="$HOME/.bun/bin:$PATH" && bun run version:set <VERSION>
```

Verify all 20 package.json files were updated by checking the root `package.json`.

## Step 5: Commit Version Bump

```bash
git add -A
git commit -m "chore: bump all packages to <VERSION>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
git push origin next
```

## Step 6: Create PR

Create a pull request from `next` to `master` using `gh pr create`. The PR title should be: `release: <VERSION>`. The body should summarize the changes since the last release using `git log --oneline master..next`.

## Step 7: Merge PR

```bash
gh pr merge --merge
```

Then sync master locally:

```bash
git checkout master && git pull origin master
```

## Step 8: Publish All Packages

Publish all 20 packages to npm with `--tag latest`:

```bash
export PATH="$HOME/.bun/bin:$PATH"
for pkg in core helpers database auth cli events filesystem logging mail notify oauth queue realtime search social-auth validation vite health heartbeat; do
  cd "packages/$pkg" && npm publish --access public --tag latest && cd ../..
done
cd packages/create-mantiq && npm publish --access public --tag latest && cd ../..
```

If any package fails to publish, report it but continue with the remaining packages.

## Step 9: Sync Branches

```bash
git checkout next && git merge master --no-edit && git push origin next
```

## Completion

Report the final status:
- Version published
- Number of packages published (should be 20)
- PR number and URL
- Any warnings or issues encountered

## Safety Rules

- **NEVER skip tests** — typecheck, unit tests, and e2e must all pass
- **NEVER publish from a dirty working tree** — all changes must be committed
- **ALWAYS use PRs to merge into master** — never push directly to master
- **NEVER use --force** on any git or npm command
- **STOP on failure** — if any critical step fails, do not continue
