#!/usr/bin/env bun
import { Kernel } from './Kernel.ts'
import { MigrateCommand } from './commands/MigrateCommand.ts'
import { MigrateRollbackCommand } from './commands/MigrateRollbackCommand.ts'
import { MigrateResetCommand } from './commands/MigrateResetCommand.ts'
import { MigrateFreshCommand } from './commands/MigrateFreshCommand.ts'
import { MigrateStatusCommand } from './commands/MigrateStatusCommand.ts'
import { SeedCommand } from './commands/SeedCommand.ts'
import { MakeControllerCommand } from './commands/MakeControllerCommand.ts'
import { MakeModelCommand } from './commands/MakeModelCommand.ts'
import { MakeMigrationCommand } from './commands/MakeMigrationCommand.ts'
import { MakeSeederCommand } from './commands/MakeSeederCommand.ts'
import { MakeFactoryCommand } from './commands/MakeFactoryCommand.ts'
import { MakeMiddlewareCommand } from './commands/MakeMiddlewareCommand.ts'
import { MakeRequestCommand } from './commands/MakeRequestCommand.ts'
import { ServeCommand } from './commands/ServeCommand.ts'
import { RouteListCommand } from './commands/RouteListCommand.ts'
import { TinkerCommand } from './commands/TinkerCommand.ts'

async function main() {
  // Try to bootstrap the application if an index.ts exists
  let app: any = null
  try {
    const entryPath = `${process.cwd()}/index.ts`
    const mod = await import(entryPath)
    app = mod.default ?? mod.app ?? null
  } catch {
    // No app entry — that's fine for make:* commands
  }

  const kernel = new Kernel(app)

  kernel.registerAll([
    // Database
    new MigrateCommand(),
    new MigrateRollbackCommand(),
    new MigrateResetCommand(),
    new MigrateFreshCommand(),
    new MigrateStatusCommand(),
    new SeedCommand(),

    // Generators
    new MakeControllerCommand(),
    new MakeModelCommand(),
    new MakeMigrationCommand(),
    new MakeSeederCommand(),
    new MakeFactoryCommand(),
    new MakeMiddlewareCommand(),
    new MakeRequestCommand(),

    // Utility
    new ServeCommand(),
    new RouteListCommand(),
    new TinkerCommand(),
  ])

  const code = await kernel.run()
  process.exit(code)
}

main()
