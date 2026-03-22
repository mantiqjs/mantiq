import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

export class KeyGenerateCommand extends Command {
  override name = 'key:generate'
  override description = 'Generate an application encryption key'
  override usage = 'key:generate [--show] [--force]'

  override async handle(args: ParsedArgs): Promise<number> {
    const key = `base64:${randomBytes(32).toString('base64')}`
    const showOnly = args.flags['show'] === true

    if (showOnly) {
      this.io.line(`  ${key}`)
      return 0
    }

    const envPath = `${process.cwd()}/.env`

    if (!existsSync(envPath)) {
      this.io.error('  .env file not found. Create one first.')
      return 1
    }

    let env = readFileSync(envPath, 'utf8')
    const hasKey = /^APP_KEY=.+$/m.test(env) && !/^APP_KEY=\s*$/m.test(env)

    if (hasKey && args.flags['force'] !== true) {
      this.io.warn('  APP_KEY is already set. Use --force to overwrite.')
      return 1
    }

    if (/^APP_KEY=/m.test(env)) {
      env = env.replace(/^APP_KEY=.*$/m, `APP_KEY=${key}`)
    } else {
      env = `APP_KEY=${key}\n${env}`
    }

    writeFileSync(envPath, env)
    this.io.success(`  APP_KEY set successfully.`)

    return 0
  }
}
