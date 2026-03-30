import type { Command } from './Command.ts'
import { parse, type ParsedArgs } from './Parser.ts'
import { IO } from './IO.ts'
import { getRegisteredCommands } from './CommandRegistry.ts'

// Built-in commands — utility
import { AboutCommand } from './commands/AboutCommand.ts'
import { KeyGenerateCommand } from './commands/KeyGenerateCommand.ts'
import { ServeCommand } from './commands/ServeCommand.ts'
import { RouteListCommand } from './commands/RouteListCommand.ts'
import { TinkerCommand } from './commands/TinkerCommand.ts'
import { DownCommand } from './commands/DownCommand.ts'
import { UpCommand } from './commands/UpCommand.ts'
import { CacheClearCommand } from './commands/CacheClearCommand.ts'
import { StorageLinkCommand } from './commands/StorageLinkCommand.ts'
import { ConfigCacheCommand, ConfigClearCommand } from './commands/ConfigCacheCommand.ts'
import { OptimizeCommand, OptimizeClearCommand } from './commands/OptimizeCommand.ts'
import { GenerateSchemaCommand } from './commands/GenerateSchemaCommand.ts'

// Built-in commands — database
import { MigrateCommand } from './commands/MigrateCommand.ts'
import { MigrateRollbackCommand } from './commands/MigrateRollbackCommand.ts'
import { MigrateResetCommand } from './commands/MigrateResetCommand.ts'
import { MigrateFreshCommand } from './commands/MigrateFreshCommand.ts'
import { MigrateStatusCommand } from './commands/MigrateStatusCommand.ts'
import { SeedCommand } from './commands/SeedCommand.ts'

// Built-in commands — generators
import { MakeCommandCommand } from './commands/MakeCommandCommand.ts'
import { MakeControllerCommand } from './commands/MakeControllerCommand.ts'
import { MakeEventCommand } from './commands/MakeEventCommand.ts'
import { MakeExceptionCommand } from './commands/MakeExceptionCommand.ts'
import { MakeFactoryCommand } from './commands/MakeFactoryCommand.ts'
import { MakeJobCommand } from './commands/MakeJobCommand.ts'
import { MakeListenerCommand } from './commands/MakeListenerCommand.ts'
import { MakeMailCommand } from './commands/MakeMailCommand.ts'
import { MakeMiddlewareCommand } from './commands/MakeMiddlewareCommand.ts'
import { MakeMigrationCommand } from './commands/MakeMigrationCommand.ts'
import { MakeModelCommand } from './commands/MakeModelCommand.ts'
import { MakeNotificationCommand } from './commands/MakeNotificationCommand.ts'
import { MakeObserverCommand } from './commands/MakeObserverCommand.ts'
import { MakePolicyCommand } from './commands/MakePolicyCommand.ts'
import { MakeProviderCommand } from './commands/MakeProviderCommand.ts'
import { MakeRequestCommand } from './commands/MakeRequestCommand.ts'
import { MakeRuleCommand } from './commands/MakeRuleCommand.ts'
import { MakeSeederCommand } from './commands/MakeSeederCommand.ts'
import { MakeTestCommand } from './commands/MakeTestCommand.ts'

/**
 * The CLI Kernel — registers commands and dispatches to the right one.
 */
export class Kernel {
  private commands = new Map<string, Command>()
  private io = new IO()
  private discovered = false
  private builtinsRegistered = false

  /** Hook called after each command execution. Set by observability providers. */
  static _onCommandExecuted: ((data: { name: string; args: Record<string, any>; exitCode: number; duration: number }) => void) | null = null

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
   * Register all built-in framework commands (utility, database, generators).
   * Called once on the first run() invocation.
   */
  private registerBuiltins(): void {
    this.registerAll([
      // Utility
      new AboutCommand(),
      new KeyGenerateCommand(),
      new ServeCommand(),
      new RouteListCommand(),
      new TinkerCommand(),
      new DownCommand(),
      new UpCommand(),
      new CacheClearCommand(),
      new StorageLinkCommand(),
      new ConfigCacheCommand(),
      new ConfigClearCommand(),
      new OptimizeCommand(),
      new OptimizeClearCommand(),

      new GenerateSchemaCommand(),

      // Database
      new MigrateCommand(),
      new MigrateRollbackCommand(),
      new MigrateResetCommand(),
      new MigrateFreshCommand(),
      new MigrateStatusCommand(),
      new SeedCommand(),

      // Generators
      new MakeCommandCommand(),
      new MakeControllerCommand(),
      new MakeEventCommand(),
      new MakeExceptionCommand(),
      new MakeFactoryCommand(),
      new MakeJobCommand(),
      new MakeListenerCommand(),
      new MakeMailCommand(),
      new MakeMiddlewareCommand(),
      new MakeMigrationCommand(),
      new MakeModelCommand(),
      new MakeNotificationCommand(),
      new MakeObserverCommand(),
      new MakePolicyCommand(),
      new MakeProviderCommand(),
      new MakeRequestCommand(),
      new MakeRuleCommand(),
      new MakeSeederCommand(),
      new MakeTestCommand(),
    ])
  }

  /**
   * Dynamically import and register commands from optional packages.
   * Uses try/catch so the CLI works fine when a package isn't installed.
   *
   * Note: Queue commands (queue:work, queue:retry, etc.) require a QueueManager
   * instance and are registered by QueueServiceProvider.boot() instead.
   */
  private async registerPackageCommands(): Promise<void> {
    // Heartbeat commands (if @mantiq/heartbeat is installed)
    try {
      const { InstallCommand } = await import('@mantiq/heartbeat')
      this.register(new InstallCommand())
    } catch {
      // @mantiq/heartbeat not installed — skip heartbeat commands
    }

    // Studio commands (if @mantiq/studio is installed)
    try {
      // @ts-ignore — optional dependency, may not be installed
      const studio = await import('@mantiq/studio')
      this.register(new studio.InstallCommand() as any)
      this.register(new studio.MakePanelCommand() as any)
      this.register(new studio.MakeResourceCommand() as any)
    } catch {
      // @mantiq/studio not installed — skip studio commands
    }

    // Agent rules commands (if @mantiq/agent-rules is installed)
    try {
      // @ts-ignore — optional dependency, may not be installed
      const mod = await import('@mantiq/agent-rules')
      this.register(new mod.AgentGenerateCommand() as any)
      this.register(new mod.AgentUpdateCommand() as any)
    } catch {
      // @mantiq/agent-rules not installed — skip agent commands
    }
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

    // Collect commands registered by service providers via CommandRegistry
    for (const cmd of getRegisteredCommands()) {
      if (!this.commands.has(cmd.name)) {
        this.register(cmd)
      }
    }

    this.discovered = true
    return this
  }

  async run(argv: string[] = process.argv): Promise<number> {
    if (!this.builtinsRegistered) {
      this.registerBuiltins()
      await this.registerPackageCommands()
      this.builtinsRegistered = true
    }

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

    const start = performance.now()
    let exitCode = 0
    try {
      exitCode = await command.handle(parsed)
    } catch (e: any) {
      exitCode = 1
      this.io.error(e.message ?? String(e))
      if (process.env['APP_DEBUG'] === 'true') {
        this.io.line(e.stack ?? '')
      }
    }

    if (Kernel._onCommandExecuted) {
      try {
        Kernel._onCommandExecuted({
          name: parsed.command,
          args: { ...parsed.flags, _positional: parsed.args },
          exitCode,
          duration: performance.now() - start,
        })
      } catch { /* observability must never crash CLI */ }
    }

    return exitCode
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
