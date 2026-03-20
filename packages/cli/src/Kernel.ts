import type { Command } from './Command.ts'
import { parse, type ParsedArgs } from './Parser.ts'
import { IO } from './IO.ts'

/**
 * The CLI Kernel — registers commands and dispatches to the right one.
 */
export class Kernel {
  private commands = new Map<string, Command>()
  private io = new IO()
  private discovered = false

  constructor(public readonly app: any = null) {}

  register(command: Command): this {
    this.commands.set(command.name, command)
    return this
  }

  registerAll(commands: Command[]): this {
    for (const cmd of commands) this.register(cmd)
    return this
  }

  /**
   * Auto-discover and register command files from app/Console/Commands/.
   * Each file must export a class that extends Command.
   */
  async discover(basePath?: string): Promise<this> {
    if (this.discovered) return this

    const dir = (basePath ?? process.cwd()) + '/app/Console/Commands'
    const glob = new Bun.Glob('**/*Command.ts')

    try {
      for await (const file of glob.scan({ cwd: dir, absolute: false })) {
        try {
          const mod = await import(dir + '/' + file)
          for (const exported of Object.values(mod)) {
            if (typeof exported !== 'function') continue
            try {
              const instance = new (exported as any)()
              if (instance.name && typeof instance.handle === 'function') {
                this.register(instance)
              }
            } catch {
              // Not instantiable or not a command
            }
          }
        } catch {
          // Skip files that can't be imported
        }
      }
    } catch {
      // Directory doesn't exist — no commands to discover
    }

    this.discovered = true
    return this
  }

  async run(argv: string[] = process.argv): Promise<number> {
    await this.discover()
    const parsed = parse(argv)

    if (parsed.command === 'help' || parsed.command === '--help' || parsed.command === '-h' || parsed.flags['help'] || parsed.flags['h']) {
      this.showHelp(parsed)
      return 0
    }

    const command = this.commands.get(parsed.command)
    if (!command) {
      this.io.error(`Command "${parsed.command}" not found.`)
      this.io.newLine()
      this.showHelp(parsed)
      return 1
    }

    try {
      return await command.handle(parsed)
    } catch (e: any) {
      this.io.error(e.message ?? String(e))
      if (process.env['APP_DEBUG'] === 'true') {
        this.io.line(e.stack ?? '')
      }
      return 1
    }
  }

  private showHelp(_parsed: ParsedArgs): void {
    this.io.brand()
    this.io.line('  Usage: mantiq <command> [arguments] [options]')
    this.io.newLine()

    // Group commands by prefix
    const groups = new Map<string, Command[]>()
    for (const cmd of this.commands.values()) {
      const prefix = cmd.name.includes(':') ? cmd.name.split(':')[0]! : ''
      if (!groups.has(prefix)) groups.set(prefix, [])
      groups.get(prefix)!.push(cmd)
    }

    // Sort groups: top-level first, then alphabetical
    const sortedGroups = [...groups.entries()].sort((a, b) => {
      if (a[0] === '' && b[0] !== '') return -1
      if (a[0] !== '' && b[0] === '') return 1
      return a[0].localeCompare(b[0])
    })

    for (const [prefix, cmds] of sortedGroups) {
      if (prefix) {
        this.io.line(`  ${this.io.emerald(prefix)}`)
      }
      const sorted = cmds.sort((a, b) => a.name.localeCompare(b.name))
      for (const cmd of sorted) {
        this.io.twoColumn(`    ${this.io.green(cmd.name)}`, cmd.description, 30)
      }
    }

    this.io.newLine()
  }
}
