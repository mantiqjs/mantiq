#!/usr/bin/env bun
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { getTemplates } from './templates.ts'
import { Terminal } from './terminal.ts'

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
    --ui=${emerald('shadcn')}               UI component library (React only)
    --no-git                   Skip git initialization
    --yes                      Accept defaults (non-interactive)

  ${bold('Examples:')}
    bun create mantiq my-app
    bun create mantiq my-app --kit=react
    bun create mantiq my-app --kit=react --ui=shadcn
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
let ui: 'shadcn' | 'none' = (flags['ui'] as string) === 'shadcn' ? 'shadcn' : 'none'

if (!isCI && !kit) {
  // Show branded header
  term.header()

  // Framework selection
  const framework = await term.select('Which framework would you like to use?', [
    { value: 'react', label: 'React', hint: 'Recommended' },
    { value: 'vue', label: 'Vue' },
    { value: 'svelte', label: 'Svelte' },
    { value: 'none', label: 'None', hint: 'API only' },
  ])

  kit = framework === 'none' ? undefined : framework as Kit

  // UI kit selection (React only)
  if (kit === 'react' && !flags['ui']) {
    const uiChoice = await term.select('Which UI kit?', [
      { value: 'none', label: 'Plain Tailwind' },
      { value: 'shadcn', label: 'shadcn/ui', hint: 'Radix + Tailwind' },
    ])
    ui = uiChoice as 'shadcn' | 'none'
  }
} else {
  // Validate flags
  if (kit && !validKits.includes(kit as Kit)) {
    console.error(`\n  ${red('ERROR')}  Invalid kit "${kit}". Valid options: ${validKits.join(', ')}\n`)
    process.exit(1)
  }
  if (ui === 'shadcn' && kit !== 'react') {
    console.error(`\n  ${red('ERROR')}  shadcn/ui is only available with --kit=react\n`)
    process.exit(1)
  }
  term.header()
}

// ── Generate ─────────────────────────────────────────────────────────────────
term.step('Scaffolding project')

const appKey = `base64:${randomBytes(32).toString('base64')}`
const templates = getTemplates({ name: projectName, appKey, kit, ui })

// Write all files
const files = Object.keys(templates).sort()
for (const relativePath of files) {
  const fullPath = `${projectDir}/${relativePath}`
  mkdirSync(dirname(fullPath), { recursive: true })
  await Bun.write(fullPath, templates[relativePath]!)
}
console.log(`  ${dim(`${files.length} files created`)}`)

// ── Install dependencies ─────────────────────────────────────────────────────
const spin = term.spinner('Installing dependencies')

const install = Bun.spawn(['bun', 'install'], {
  cwd: projectDir,
  stdout: 'pipe',
  stderr: 'pipe',
})
await install.exited
spin.stop('Dependencies installed')

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
const summaryLines = [
  `${emerald('✓')} ${bold(projectName)} created`,
  '',
  `${dim('Framework')}    ${kit ? bold(kit.charAt(0).toUpperCase() + kit.slice(1)) : dim('None (API only)')}`,
  ...(kit === 'react' ? [`${dim('UI Kit')}       ${ui === 'shadcn' ? bold('shadcn/ui') : dim('Plain Tailwind')}`] : []),
  '',
  `${emerald('cd')} ${projectName}`,
  `${emerald('bun mantiq')} migrate`,
  `${emerald('bun run')} dev`,
]

term.box(summaryLines)
