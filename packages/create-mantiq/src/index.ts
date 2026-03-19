#!/usr/bin/env bun
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { getTemplates } from './templates.ts'

// ── ANSI helpers ─────────────────────────────────────────────────────────────
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`
const green = (s: string) => `\x1b[32m${s}\x1b[0m`
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`
const red = (s: string) => `\x1b[31m${s}\x1b[0m`

// ── Parse args ───────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2)
const flags: Record<string, boolean> = {}
const positional: string[] = []

for (const arg of rawArgs) {
  if (arg.startsWith('--')) flags[arg.slice(2)] = true
  else if (!arg.startsWith('-')) positional.push(arg)
}

const projectName = positional[0]
const noGit = !!flags['no-git']

if (!projectName) {
  console.log(`
  ${bold('create-mantiq')} — Scaffold a new MantiqJS application

  ${bold('Usage:')}
    bun create mantiq ${cyan('<project-name>')} [options]

  ${bold('Options:')}
    --no-git    Skip git initialization

  ${bold('Example:')}
    bun create mantiq my-app
`)
  process.exit(1)
}

const projectDir = resolve(process.cwd(), projectName)

if (existsSync(projectDir)) {
  console.error(`\n  ${red('ERROR')}  Directory "${projectName}" already exists.\n`)
  process.exit(1)
}

// ── Generate ─────────────────────────────────────────────────────────────────
console.log(`\n  ${bold('Creating')} ${cyan(projectName)}...\n`)

const appKey = `base64:${randomBytes(32).toString('base64')}`
const templates = getTemplates({ name: projectName, appKey })

// Write all files
const files = Object.keys(templates).sort()
for (const relativePath of files) {
  const fullPath = `${projectDir}/${relativePath}`
  mkdirSync(dirname(fullPath), { recursive: true })
  await Bun.write(fullPath, templates[relativePath]!)

  const display = relativePath.endsWith('.gitkeep') ? dim(relativePath) : green(relativePath)
  console.log(`    ${green('+')} ${display}`)
}

// ── Install dependencies ─────────────────────────────────────────────────────
console.log(`\n  ${bold('Installing dependencies...')}\n`)

const install = Bun.spawn(['bun', 'install'], {
  cwd: projectDir,
  stdout: 'inherit',
  stderr: 'inherit',
})
await install.exited

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
console.log(`
  ${green('✓')} ${bold('Created')} ${cyan(projectName)} ${bold('successfully!')}

  ${bold('Next steps:')}

    ${cyan('cd')} ${projectName}
    ${cyan('bun mantiq')} migrate       ${dim('# run database migrations')}
    ${cyan('bun run')} dev              ${dim('# start development server')}
    ${cyan('bun mantiq')} tinker        ${dim('# interactive REPL')}

  ${dim('Happy building!')}
`)
