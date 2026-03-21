import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { createInterface } from 'node:readline'
import { readdirSync, existsSync } from 'node:fs'

/**
 * Interactive REPL with the full application context loaded.
 * Like Laravel's `php artisan tinker`.
 */
export class TinkerCommand extends Command {
  override name = 'tinker'
  override description = 'Interact with your application (REPL)'
  override usage = 'tinker'

  override async handle(_args: ParsedArgs): Promise<number> {
    // ── Bootstrap the app ──────────────────────────────────────────────────
    let app: any = null
    const context: Record<string, any> = {}

    try {
      const entryPath = `${process.cwd()}/index.ts`
      const mod = await import(entryPath)
      app = mod.default ?? mod.app
    } catch (e: any) {
      this.io.warn(`Could not load app: ${e.message}`)
    }

    if (app) {
      context['app'] = app

      // Resolve core services
      try {
        const core = await import('@mantiq/core')
        const tryMake = (key: any, name: string) => {
          try { const v = app.make(key); if (v) context[name] = v } catch {}
        }
        tryMake(core.RouterImpl, 'router')
        tryMake(core.ConfigRepository, 'config')
        tryMake(core.HashManager, 'hash')
        tryMake(core.CacheManager, 'cache')
        tryMake(core.SessionManager, 'session')
        tryMake(core.AesEncrypter, 'encrypter')
      } catch {}

      // Resolve database
      try {
        const db = await import('@mantiq/database')
        if (db.getManager) {
          const manager = db.getManager()
          context['db'] = manager
          context['connection'] = manager.connection()
        }
      } catch {}

      // Resolve auth
      try {
        const auth = await import('@mantiq/auth')
        if (auth.auth) context['auth'] = auth.auth
      } catch {}
    }

    // ── Auto-import models ───────────────────────────────────────────────
    const modelsDir = `${process.cwd()}/app/Models`
    if (existsSync(modelsDir)) {
      const files = readdirSync(modelsDir).filter((f) => f.endsWith('.ts'))
      for (const file of files) {
        try {
          const mod = await import(`${modelsDir}/${file}`)
          const name = file.replace(/\.ts$/, '')
          // Export the class (named export matching filename, or first export)
          const cls = mod[name] ?? mod.default ?? Object.values(mod)[0]
          if (cls) context[name] = cls
        } catch {}
      }
    }

    // ── Auto-import factories ─────────────────────────────────────────────
    const factoriesDir = `${process.cwd()}/database/factories`
    if (existsSync(factoriesDir)) {
      const files = readdirSync(factoriesDir).filter((f) => f.endsWith('.ts'))
      for (const file of files) {
        try {
          const mod = await import(`${factoriesDir}/${file}`)
          const name = file.replace(/\.ts$/, '')
          const cls = mod[name] ?? mod.default ?? Object.values(mod)[0]
          if (cls) context[name] = cls
        } catch {}
      }
    }

    // ── Assign to globalThis ─────────────────────────────────────────────
    for (const [key, value] of Object.entries(context)) {
      ;(globalThis as any)[key] = value
    }

    // ── Print banner ─────────────────────────────────────────────────────
    this.io.heading('MantiqJS Tinker')
    this.io.muted('  Interactive REPL — type expressions, use await for async.')
    this.io.muted('  Type .help for commands, .exit to quit.\n')

    if (Object.keys(context).length > 0) {
      this.io.info('Available in scope:')
      const items = Object.keys(context)
      const perLine = 6
      for (let i = 0; i < items.length; i += perLine) {
        const chunk = items.slice(i, i + perLine)
        this.io.line(`    ${chunk.map((k) => this.io.cyan(k)).join(', ')}`)
      }
      this.io.newLine()
    }

    // ── REPL loop ────────────────────────────────────────────────────────
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '\x1b[35m>\x1b[0m ',
      historySize: 200,
    })

    let multiLine = ''
    let multiLineMode = false

    const evaluate = async (input: string) => {
      const trimmed = input.trim()
      if (!trimmed) return

      // Dot commands
      if (trimmed === '.exit' || trimmed === '.quit') {
        rl.close()
        return
      }
      if (trimmed === '.help') {
        this.io.line('  .exit       Exit the REPL')
        this.io.line('  .clear      Clear the terminal')
        this.io.line('  .models     List loaded models')
        this.io.line('  .services   List available services')
        this.io.line('')
        return
      }
      if (trimmed === '.clear') {
        process.stdout.write('\x1b[2J\x1b[H')
        return
      }
      if (trimmed === '.models') {
        const modelFiles = existsSync(modelsDir)
          ? readdirSync(modelsDir).filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, ''))
          : []
        if (modelFiles.length) {
          this.io.line(`  ${modelFiles.map((m) => this.io.cyan(m)).join(', ')}`)
        } else {
          this.io.muted('  No models found.')
        }
        return
      }
      if (trimmed === '.services') {
        const svcs = Object.keys(context).filter((k) => !['app'].includes(k) && typeof context[k] !== 'function' || k === 'auth')
        this.io.line(`  ${svcs.map((s) => this.io.cyan(s)).join(', ')}`)
        return
      }

      try {
        // Wrap in async to support top-level await
        const code = `(async () => { return (${trimmed}) })()`
        const result = await eval(code)

        if (result !== undefined) {
          this.printResult(result)
        }
      } catch {
        // Retry as statement (not expression)
        try {
          const code = `(async () => { ${trimmed} })()`
          const result = await eval(code)
          if (result !== undefined) {
            this.printResult(result)
          }
        } catch (e2: any) {
          this.io.error(e2.message ?? String(e2))
        }
      }
    }

    rl.prompt()

    return new Promise<number>((resolve) => {
      rl.on('line', async (line) => {
        const trimmed = line.trimEnd()

        // Multiline: if line ends with \, accumulate
        if (trimmed.endsWith('\\')) {
          multiLine += trimmed.slice(0, -1) + '\n'
          multiLineMode = true
          process.stdout.write('\x1b[35m…\x1b[0m ')
          return
        }

        if (multiLineMode) {
          multiLine += line
          multiLineMode = false
          await evaluate(multiLine)
          multiLine = ''
        } else {
          await evaluate(line)
        }

        rl.prompt()
      })

      rl.on('close', () => {
        this.io.newLine()
        this.io.muted('  Goodbye.')
        resolve(0)
      })
    })
  }

  private printResult(value: any): void {
    if (value === null) {
      this.io.line(`\x1b[90mnull\x1b[0m`)
      return
    }
    if (value === undefined) return

    // Model instances — show as object
    if (value && typeof value === 'object' && typeof value.toObject === 'function') {
      try {
        const obj = value.toObject()
        this.io.line(this.formatObject(obj))
        return
      } catch {}
    }

    // Arrays of models
    if (Array.isArray(value) && value.length > 0 && typeof value[0]?.toObject === 'function') {
      try {
        const arr = value.map((v: any) => v.toObject())
        this.io.line(this.formatObject(arr))
        return
      } catch {}
    }

    // Plain objects/arrays
    if (typeof value === 'object') {
      this.io.line(this.formatObject(value))
      return
    }

    // Primitives
    if (typeof value === 'string') {
      this.io.line(`\x1b[32m'${value}'\x1b[0m`)
    } else if (typeof value === 'number' || typeof value === 'bigint') {
      this.io.line(`\x1b[33m${value}\x1b[0m`)
    } else if (typeof value === 'boolean') {
      this.io.line(`\x1b[33m${value}\x1b[0m`)
    } else if (typeof value === 'function') {
      this.io.line(`\x1b[36m[Function: ${value.name || 'anonymous'}]\x1b[0m`)
    } else {
      this.io.line(String(value))
    }
  }

  private formatObject(obj: any, indent = 0): string {
    try {
      const json = JSON.stringify(obj, null, 2)
      // Colorize JSON output
      return json
        .replace(/"([^"]+)":/g, `\x1b[36m"$1"\x1b[0m:`)
        .replace(/: "([^"]*)"/g, `: \x1b[32m"$1"\x1b[0m`)
        .replace(/: (\d+)/g, `: \x1b[33m$1\x1b[0m`)
        .replace(/: (true|false|null)/g, `: \x1b[33m$1\x1b[0m`)
    } catch {
      return String(obj)
    }
  }
}
