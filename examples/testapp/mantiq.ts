#!/usr/bin/env bun
await import('./index.ts')

import { Kernel } from '@mantiq/cli'
import {
  MigrateCommand,
  MigrateRollbackCommand,
  MigrateResetCommand,
  MigrateFreshCommand,
  MigrateStatusCommand,
  SeedCommand,
  MakeControllerCommand,
  MakeModelCommand,
  MakeMigrationCommand,
  MakeSeederCommand,
  MakeFactoryCommand,
  MakeMiddlewareCommand,
  MakeRequestCommand,
  ServeCommand,
  RouteListCommand,
  TinkerCommand,
} from '@mantiq/cli'

const kernel = new Kernel()

kernel.registerAll([
  new MigrateCommand(),
  new MigrateRollbackCommand(),
  new MigrateResetCommand(),
  new MigrateFreshCommand(),
  new MigrateStatusCommand(),
  new SeedCommand(),
  new MakeControllerCommand(),
  new MakeModelCommand(),
  new MakeMigrationCommand(),
  new MakeSeederCommand(),
  new MakeFactoryCommand(),
  new MakeMiddlewareCommand(),
  new MakeRequestCommand(),
  new ServeCommand(),
  new RouteListCommand(),
  new TinkerCommand(),
])

const code = await kernel.run()
process.exit(code)
