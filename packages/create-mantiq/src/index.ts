#!/usr/bin/env bun
import { existsSync, mkdirSync, readdirSync, statSync, readFileSync } from 'node:fs'
import { dirname, resolve, join, relative } from 'node:path'
import { randomBytes } from 'node:crypto'
import { getTemplates, type Theme } from './templates.ts'
import { Terminal } from './terminal.ts'

/**
 * Recursively copy a directory, preserving structure.
 * Skips node_modules, .git, bun.lock, *.sqlite files.
 * `skipRelPaths` contains relative paths (from root src) to skip.
 */
async function copyDirectory(src: string, dest: string, skipRelPaths?: Set<string>, rootSrc?: string): Promise<number> {
  let count = 0
  const root = rootSrc ?? src
  const entries = readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)

    // Skip files that shouldn't be copied
    if (['node_modules', '.git', 'bun.lock', 'README.md'].includes(entry.name)) continue
    if (entry.name.endsWith('.sqlite') || entry.name.endsWith('.sqlite-wal') || entry.name.endsWith('.sqlite-shm')) continue

    // Skip paths in the conditional skip set
    if (skipRelPaths) {
      const rel = relative(root, srcPath)
      if (skipRelPaths.has(rel)) continue
    }

    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true })
      count += await copyDirectory(srcPath, destPath, skipRelPaths, root)
    } else {
      mkdirSync(dirname(destPath), { recursive: true })
      await Bun.write(destPath, Bun.file(srcPath))
      count++
    }
  }
  return count
}

// ── ANSI helpers ─────────────────────────────────────────────────────────────
const R = '\x1b[0m'
const bold = (s: string) => `\x1b[1m${s}${R}`
const dim = (s: string) => `\x1b[2m${s}${R}`
const red = (s: string) => `\x1b[31m${s}${R}`
const emerald = (s: string) => `\x1b[38;2;52;211;153m${s}${R}`

// ── Parse args ───────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2)
const flags: Record<string, string | boolean> = {}
const positional: string[] = []

for (const arg of rawArgs) {
  if (arg.startsWith('--')) {
    const body = arg.slice(2)
    const eqIdx = body.indexOf('=')
    if (eqIdx !== -1) {
      flags[body.slice(0, eqIdx)] = body.slice(eqIdx + 1)
    } else {
      flags[body] = true
    }
  } else if (!arg.startsWith('-')) {
    positional.push(arg)
  }
}

const validKits = ['react', 'vue', 'svelte'] as const
type Kit = typeof validKits[number]

const projectName = positional[0]
const noGit = !!flags['no-git']
const isCI = !process.stdin.isTTY || !!flags['yes'] || !!flags['y']

if (!projectName) {
  console.log(`
  ${emerald('·')}${bold('mantiq')} ${dim('framework')}

  ${bold('Usage:')}
    bun create mantiq ${emerald('<project-name>')} [options]

  ${bold('Options:')}
    --kit=${emerald('react|vue|svelte')}    Frontend framework
    --ui=${emerald('shadcn|tailwind')}      UI component library
    --theme=${emerald('default|minimal|workspace|corporate|starter')}
                               Dashboard theme (shadcn only)
    --auth=${emerald('builtin|none')}       Authentication setup
    --with=${emerald('ai,studio')}           Optional packages (comma-separated)
    --no-git                   Skip git initialization
    --yes                      Accept defaults (non-interactive)

  ${bold('Examples:')}
    bun create mantiq my-app
    bun create mantiq my-app --kit=react
    bun create mantiq my-app --kit=react --ui=shadcn
    bun create mantiq my-app --kit=react --auth=none
    bun create mantiq my-app --kit=react --with=ai,studio
`)
  process.exit(1)
}

const projectDir = resolve(process.cwd(), projectName)

if (existsSync(projectDir)) {
  console.error(`\n  ${red('ERROR')}  Directory "${projectName}" already exists.\n`)
  process.exit(1)
}

// ── Interactive prompts ──────────────────────────────────────────────────────
const term = new Terminal()

let kit: Kit | undefined = flags['kit'] as Kit | undefined
let ui: 'shadcn' | 'tailwind' = (flags['ui'] as string) === 'tailwind' ? 'tailwind' : 'shadcn'
const validThemes = ['default', 'minimal', 'workspace', 'corporate', 'starter'] as const
let theme: Theme = (validThemes as readonly string[]).includes(flags['theme'] as string)
  ? (flags['theme'] as Theme)
  : 'default'
let auth: 'builtin' | 'none' = (flags['auth'] as string) === 'none' ? 'none' : 'builtin'
let optionalPackages: string[] = typeof flags['with'] === 'string'
  ? flags['with'].split(',').map(s => s.trim()).filter(Boolean)
  : []

if (!isCI && !kit) {
  // Show branded header
  term.header()

  // Framework selection
  const framework = await term.select('Which framework would you like to use?', [
    { value: 'react', label: 'React' },
    { value: 'vue', label: 'Vue' },
    { value: 'svelte', label: 'Svelte' },
    { value: 'none', label: 'Vanilla', hint: 'API only' },
  ])

  kit = framework === 'none' ? undefined : framework as Kit

  // UI kit selection (only if a frontend framework was chosen)
  if (kit && !flags['ui']) {
    const uiChoice = await term.select('Choose a UI kit', [
      { value: 'shadcn', label: 'shadcn + Tailwind' },
      { value: 'tailwind', label: 'Tailwind only' },
    ])
    ui = uiChoice as 'shadcn' | 'tailwind'
  }

  // Theme selection (only for shadcn)
  if (kit && ui === 'shadcn' && !flags['theme']) {
    const themeChoice = await term.select('Choose a theme', [
      { value: 'default', label: 'Default', hint: 'emerald, classic admin' },
      { value: 'minimal', label: 'Minimal', hint: 'clean & focused' },
      { value: 'workspace', label: 'Workspace', hint: 'warm & approachable' },
      { value: 'corporate', label: 'Corporate', hint: 'professional & data-rich' },
      { value: 'starter', label: 'Starter', hint: 'bold & marketing-ready' },
    ])
    theme = themeChoice as Theme
  }

  // Authentication selection
  if (!flags['auth']) {
    const authChoice = await term.select('Authentication', [
      { value: 'builtin', label: 'Built-in', hint: 'session + token auth' },
      { value: 'none', label: 'None' },
    ])
    auth = authChoice as 'builtin' | 'none'
  }

  // Optional packages selection
  if (!flags['with']) {
    optionalPackages = await term.multiSelect('Optional packages', [
      { value: 'ai', label: 'AI', hint: '@mantiq/ai' },
      { value: 'studio', label: 'Studio', hint: '@mantiq/studio — admin panel' },
    ])
  }

} else {
  // Validate flags
  if (kit && !validKits.includes(kit as Kit)) {
    console.error(`\n  ${red('ERROR')}  Invalid kit "${kit}". Valid options: ${validKits.join(', ')}\n`)
    process.exit(1)
  }
  term.header()
}

// ── Generate ─────────────────────────────────────────────────────────────────
term.step('Scaffolding project')

let fileCount = 0

// Step 1: Copy the skeleton directory as the base
const skeletonDir = resolve(import.meta.dir, '..', 'skeleton')
if (existsSync(skeletonDir)) {
  // Build conditional skip set for skeleton files
  const skeletonSkips = new Set<string>()
  if (auth === 'none') {
    skeletonSkips.add('config/auth.ts')
    skeletonSkips.add('database/migrations/002_create_personal_access_tokens_table.ts')
  }
  if (!optionalPackages.includes('ai')) {
    skeletonSkips.add('config/ai.ts')
  }
  fileCount += await copyDirectory(skeletonDir, projectDir, skeletonSkips)
} else {
  // Fallback: skeleton not bundled (shouldn't happen in published package)
  console.error('  Skeleton directory not found')
}

// Step 2: Generate dynamic files (package.json, .env — overwrites skeleton versions)
const appKey = `base64:${randomBytes(32).toString('base64')}`
const templates = getTemplates({ name: projectName, appKey, kit, ui, theme, auth, optionalPackages })
for (const [relativePath, content] of Object.entries(templates)) {
  const fullPath = `${projectDir}/${relativePath}`
  mkdirSync(dirname(fullPath), { recursive: true })
  await Bun.write(fullPath, content)
  fileCount++
}

// Step 3: Overlay starter kit stubs (new files + route overrides)
if (kit) {
  const stubsDir = resolve(import.meta.dir, '..', 'stubs')
  const manifestPath = resolve(stubsDir, 'manifest.json')

  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(await Bun.file(manifestPath).text())
    const kitManifest = manifest[kit]
    const sharedManifest = manifest.shared

    // Auth-related shared stubs to skip when auth === 'none'
    const authSharedTargets = new Set([
      'app/Http/Controllers/AuthController.ts',
      'app/Http/Controllers/PageController.ts',
      'app/Http/Requests/LoginRequest.ts',
      'app/Http/Requests/RegisterRequest.ts',
      'routes/web.ts',
      'tests/feature/auth.test.ts',
    ])

    // Targets that tailwind-only stubs will override — skip from shadcn kit
    const tailwindOnlyManifest = manifest['tailwind-only']?.[kit]
    const tailwindOverrideTargets = new Set<string>()
    if (ui === 'tailwind' && tailwindOnlyManifest?.files) {
      for (const { target } of tailwindOnlyManifest.files) {
        tailwindOverrideTargets.add(target)
      }
    }

    // Kit-specific stubs (src/, vite.config.ts, etc.)
    if (kitManifest?.files) {
      for (const { stub, target } of kitManifest.files) {
        // Skip components.json when ui === 'tailwind'
        if (ui === 'tailwind' && stub === 'components.json.stub') continue
        // Skip files that will be overridden by tailwind-only stubs
        if (ui === 'tailwind' && tailwindOverrideTargets.has(target)) continue
        const src = resolve(stubsDir, kit, stub)
        const dest = resolve(projectDir, target)
        mkdirSync(dirname(dest), { recursive: true })
        await Bun.write(dest, Bun.file(src))
        fileCount++
      }
    }

    // Tailwind-only overlay: replace shadcn-dependent components with plain Tailwind versions
    if (ui === 'tailwind' && tailwindOnlyManifest?.files) {
      for (const { stub, target } of tailwindOnlyManifest.files) {
        const src = resolve(stubsDir, 'tailwind-only', kit, stub)
        const dest = resolve(projectDir, target)
        mkdirSync(dirname(dest), { recursive: true })
        await Bun.write(dest, Bun.file(src))
        fileCount++
      }
    }

    // Theme overlay: replace pages/layouts/styles with theme-specific variants
    if (ui === 'shadcn' && theme !== 'default' && kit) {
      const themeManifest = manifest.themes?.[theme]?.[kit]
      if (themeManifest?.files) {
        for (const { stub, target } of themeManifest.files) {
          const src = resolve(stubsDir, 'themes', theme, kit, stub)
          const dest = resolve(projectDir, target)
          mkdirSync(dirname(dest), { recursive: true })
          await Bun.write(dest, Bun.file(src))
          fileCount++
        }
      }
    }

    // Shared stubs (routes, controllers, config — overwrites skeleton versions)
    if (sharedManifest?.files) {
      // Build placeholder map from manifest
      const placeholders: Record<string, string> = {}
      if (sharedManifest.placeholders) {
        for (const [key, values] of Object.entries(sharedManifest.placeholders)) {
          placeholders[key] = (values as Record<string, string>)[kit!] ?? ''
        }
      }

      for (const { stub, target } of sharedManifest.files) {
        // Skip auth-related stubs when auth === 'none'
        if (auth === 'none' && authSharedTargets.has(target)) continue
        const src = resolve(stubsDir, 'shared', stub)
        const dest = resolve(projectDir, target)
        mkdirSync(dirname(dest), { recursive: true })
        let content = await Bun.file(src).text()
        for (const [key, value] of Object.entries(placeholders)) {
          content = content.replaceAll(key, value)
        }
        await Bun.write(dest, content)
        fileCount++
      }
    }

    // Noauth overlay: replace auth-aware routes/controllers/models when auth === 'none'
    if (auth === 'none') {
      const noauthManifest = manifest.noauth
      if (noauthManifest?.files) {
        for (const { stub, target } of noauthManifest.files) {
          const src = resolve(stubsDir, 'noauth', stub)
          if (existsSync(src)) {
            const dest = resolve(projectDir, target)
            mkdirSync(dirname(dest), { recursive: true })
            let content = await Bun.file(src).text()
            // Apply shared placeholders
            if (sharedManifest?.placeholders) {
              for (const [key, values] of Object.entries(sharedManifest.placeholders)) {
                const value = (values as Record<string, string>)[kit!] ?? ''
                content = content.replaceAll(key, value)
              }
            }
            await Bun.write(dest, content)
            fileCount++
          }
        }
      }
    }
  }
} else {
  // API-only: overlay token-based auth stubs
  const stubsDir = resolve(import.meta.dir, '..', 'stubs')

  // Auth-related API-only stubs to skip when auth === 'none'
  const authApiOnlyTargets = new Set([
    'app/Http/Controllers/ApiAuthController.ts',
    'app/Http/Requests/RegisterRequest.ts',
    'app/Http/Requests/LoginRequest.ts',
    'tests/feature/token-auth.test.ts',
  ])

  const apiOnlyFiles = [
    { stub: 'api-only/routes/api.ts.stub', target: 'routes/api.ts' },
    { stub: 'shared/app/Http/Controllers/ApiAuthController.ts.stub', target: 'app/Http/Controllers/ApiAuthController.ts' },
    { stub: 'shared/app/Http/Controllers/UserController.ts.stub', target: 'app/Http/Controllers/UserController.ts' },
    { stub: 'shared/app/Http/Requests/RegisterRequest.ts.stub', target: 'app/Http/Requests/RegisterRequest.ts' },
    { stub: 'shared/app/Http/Requests/LoginRequest.ts.stub', target: 'app/Http/Requests/LoginRequest.ts' },
    { stub: 'shared/app/Http/Requests/StoreUserRequest.ts.stub', target: 'app/Http/Requests/StoreUserRequest.ts' },
    { stub: 'shared/app/Http/Requests/UpdateUserRequest.ts.stub', target: 'app/Http/Requests/UpdateUserRequest.ts' },
    { stub: 'shared/database/seeders/DatabaseSeeder.ts.stub', target: 'database/seeders/DatabaseSeeder.ts' },
    { stub: 'shared/database/factories/UserFactory.ts.stub', target: 'database/factories/UserFactory.ts' },
    { stub: 'api-only/tests/feature/token-auth.test.ts.stub', target: 'tests/feature/token-auth.test.ts' },
  ]
  for (const { stub, target } of apiOnlyFiles) {
    // Skip auth-related stubs when auth === 'none'
    if (auth === 'none' && authApiOnlyTargets.has(target)) continue
    const src = resolve(stubsDir, stub)
    if (existsSync(src)) {
      const dest = resolve(projectDir, target)
      mkdirSync(dirname(dest), { recursive: true })
      await Bun.write(dest, Bun.file(src))
      fileCount++
    }
  }

  // Noauth overlay for API-only
  if (auth === 'none') {
    const manifestPath = resolve(stubsDir, 'manifest.json')
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(await Bun.file(manifestPath).text())
      const noauthManifest = manifest.noauth
      if (noauthManifest?.files) {
        for (const { stub, target } of noauthManifest.files) {
          const src = resolve(stubsDir, 'noauth', stub)
          if (existsSync(src)) {
            const dest = resolve(projectDir, target)
            mkdirSync(dirname(dest), { recursive: true })
            await Bun.write(dest, Bun.file(src))
            fileCount++
          }
        }
      }
    }
  }
}
console.log(`  ${dim(`${fileCount} files created`)}`)

// ── Install dependencies ─────────────────────────────────────────────────────
const spin = term.spinner('Installing dependencies')

const install = Bun.spawn(['bun', 'install'], {
  cwd: projectDir,
  stdout: 'pipe',
  stderr: 'pipe',
})
await install.exited
spin.stop('Dependencies installed')

// ── Install shadcn components ────────────────────────────────────────────────
if (kit === 'react' && ui === 'shadcn') {
  const shadcnSpin = term.spinner('Installing shadcn/ui components')

  const run = async (args: string[]) => {
    const p = Bun.spawn(['bunx', '--bun', ...args], {
      cwd: projectDir,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, CI: 'true' },
    })
    await p.exited
  }

  // Init shadcn
  await run(['shadcn@latest', 'init', '--defaults', '--force'])

  // Install core components + sidebar
  await run(['shadcn@latest', 'add', 'button', 'input', 'label', 'card', 'badge', 'table', 'avatar', 'separator', 'dropdown-menu', 'sheet', 'tooltip', 'sidebar', '--overwrite', '-y'])

  shadcnSpin.stop('shadcn/ui components installed')
}

// ── Build frontend (if kit) ─────────────────────────────────────────────────
if (kit) {
  const buildSpin = term.spinner('Building frontend assets')

  const viteBuild = Bun.spawn(['npx', 'vite', 'build'], {
    cwd: projectDir,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  await viteBuild.exited

  const ssrEntry = kit === 'react' ? 'src/ssr.tsx' : 'src/ssr.ts'
  const ssrBuild = Bun.spawn(['npx', 'vite', 'build', '--ssr', ssrEntry, '--outDir', 'bootstrap/ssr'], {
    cwd: projectDir,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  await ssrBuild.exited
  buildSpin.stop('Frontend built')
}

// ── Generate AI agent rules ──────────────────────────────────────────────────
const agentSpin = term.spinner('Generating AI agent rules')
try {
  const agentGen = Bun.spawn(['bun', 'run', 'mantiq', 'agent:generate'], {
    cwd: projectDir,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const agentExit = await agentGen.exited
  if (agentExit === 0) {
    agentSpin.stop('AI agent rules generated')
  } else {
    agentSpin.stop('AI agent rules skipped')
  }
} catch {
  agentSpin.stop('AI agent rules skipped')
}

// ── Git init ─────────────────────────────────────────────────────────────────
if (!noGit) {
  const gitSpin = term.spinner('Initializing git')
  const run = async (args: string[]) => {
    const p = Bun.spawn(args, { cwd: projectDir, stdout: 'pipe', stderr: 'pipe' })
    await p.exited
  }
  await run(['git', 'init'])
  await run(['git', 'add', '-A'])
  await run(['git', 'commit', '-m', 'Initial commit — scaffolded with create-mantiq'])
  gitSpin.stop('Git initialized')
}

// ── Done ─────────────────────────────────────────────────────────────────────
console.log(`\n   ${emerald('✓')}  ${bold(projectName)} created\n`)
console.log(`   ${dim('Framework')}    ${kit ? bold(kit.charAt(0).toUpperCase() + kit.slice(1)) : dim('Vanilla (API only)')}`)
if (kit) console.log(`   ${dim('UI Kit')}       ${ui === 'shadcn' ? bold('shadcn/ui') : bold('Tailwind')}`)
if (kit && ui === 'shadcn') console.log(`   ${dim('Theme')}        ${bold(theme.charAt(0).toUpperCase() + theme.slice(1))}`)
console.log(`   ${dim('Auth')}         ${auth === 'builtin' ? bold('Built-in') : dim('None')}`)
if (optionalPackages.length > 0) console.log(`   ${dim('Extras')}       ${bold(optionalPackages.join(', '))}`)
console.log(`\n   ${dim('Next steps:')}\n`)
console.log(`   cd ${projectName}`)
console.log(`   bun mantiq migrate`)
console.log(`   bun run dev\n`)

process.exit(0)
