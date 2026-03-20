#!/usr/bin/env bun
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { getTemplates } from './templates.ts'

// ── ANSI helpers ─────────────────────────────────────────────────────────────
const R = '\x1b[0m'
const bold = (s: string) => `\x1b[1m${s}${R}`
const dim = (s: string) => `\x1b[2m${s}${R}`
const red = (s: string) => `\x1b[31m${s}${R}`
const emerald = (s: string) => `\x1b[38;2;52;211;153m${s}${R}`
const gray = (s: string) => `\x1b[90m${s}${R}`

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

const projectName = positional[0]
const noGit = !!flags['no-git']
const kit = flags['kit'] as string | undefined
const validKits = ['react', 'vue', 'svelte'] as const
type Kit = typeof validKits[number]

if (!projectName) {
  console.log(`
  ${emerald('mantiq')} ${dim('framework')}

  ${bold('Usage:')}
    bun create mantiq ${emerald('<project-name>')} [options]

  ${bold('Options:')}
    --kit=${emerald('react|vue|svelte')}    Add a frontend starter kit
    --no-git                   Skip git initialization

  ${bold('Examples:')}
    bun create mantiq my-app
    bun create mantiq my-app --kit=react
    bun create mantiq my-app --kit=vue
    bun create mantiq my-app --kit=svelte
`)
  process.exit(1)
}

if (kit && !validKits.includes(kit as Kit)) {
  console.error(`\n  ${red('ERROR')}  Invalid kit "${kit}". Valid options: ${validKits.join(', ')}\n`)
  process.exit(1)
}

const projectDir = resolve(process.cwd(), projectName)

if (existsSync(projectDir)) {
  console.error(`\n  ${red('ERROR')}  Directory "${projectName}" already exists.\n`)
  process.exit(1)
}

// ── Generate ─────────────────────────────────────────────────────────────────
const kitLabel = kit ? ` ${dim('with')} ${bold(kit)}` : ''
console.log(`\n  ${emerald('mantiq')}  Creating ${bold(projectName)}${kitLabel}\n`)

const appKey = `base64:${randomBytes(32).toString('base64')}`
const templates = getTemplates({ name: projectName, appKey, kit: kit as Kit | undefined })

// Write all files
const files = Object.keys(templates).sort()
for (const relativePath of files) {
  const fullPath = `${projectDir}/${relativePath}`
  mkdirSync(dirname(fullPath), { recursive: true })
  await Bun.write(fullPath, templates[relativePath]!)

  const display = relativePath.endsWith('.gitkeep') ? dim(relativePath) : relativePath
  console.log(`    ${emerald('+')} ${display}`)
}

// ── Install dependencies ─────────────────────────────────────────────────────
console.log(`\n  ${bold('Installing dependencies...')}\n`)

const install = Bun.spawn(['bun', 'install'], {
  cwd: projectDir,
  stdout: 'inherit',
  stderr: 'inherit',
})
await install.exited

// ── Build frontend (if kit) ─────────────────────────────────────────────────
if (kit) {
  console.log(`\n  ${bold('Building frontend assets...')}\n`)

  const viteBuild = Bun.spawn(['npx', 'vite', 'build'], {
    cwd: projectDir,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  await viteBuild.exited

  const ssrEntry = kit === 'react' ? 'src/ssr.tsx' : 'src/ssr.ts'
  console.log(`\n  ${bold('Building SSR bundle...')}\n`)

  const ssrBuild = Bun.spawn(['npx', 'vite', 'build', '--ssr', ssrEntry, '--outDir', 'bootstrap/ssr'], {
    cwd: projectDir,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  await ssrBuild.exited
}

// ── Git init ─────────────────────────────────────────────────────────────────
if (!noGit) {
  const gitInit = Bun.spawn(['git', 'init'], {
    cwd: projectDir,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  await gitInit.exited

  const gitAdd = Bun.spawn(['git', 'add', '-A'], {
    cwd: projectDir,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  await gitAdd.exited

  const gitCommit = Bun.spawn(['git', 'commit', '-m', 'Initial commit — scaffolded with create-mantiq'], {
    cwd: projectDir,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  await gitCommit.exited

  console.log(`  ${dim('Initialized git repository.')}`)
}

// ── Done ─────────────────────────────────────────────────────────────────────
const frontendSteps = kit
  ? `    ${emerald('bun run')} dev:frontend     ${dim('# start Vite dev server')}\n`
  : ''

console.log(`
  ${emerald('mantiq')}  ${bold(projectName)} ready.

  ${bold('Next steps:')}

    ${emerald('cd')} ${projectName}
    ${emerald('bun mantiq')} migrate       ${dim('# run database migrations')}
    ${emerald('bun run')} dev              ${dim('# start development server')}
${frontendSteps}
  ${bold('Useful commands:')}

    ${emerald('bun mantiq')} route:list    ${dim('# list all registered routes')}
    ${emerald('bun mantiq')} make:model    ${dim('# generate a new model')}
    ${emerald('bun mantiq')} about         ${dim('# framework environment info')}

  ${dim('Dashboard  http://localhost:3000/_heartbeat')}
`)
