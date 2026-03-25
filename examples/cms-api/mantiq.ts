#!/usr/bin/env bun
await import('./index.ts')

import { Kernel } from '@mantiq/cli'
import {
  AboutCommand, MigrateCommand, MigrateRollbackCommand, MigrateResetCommand,
  MigrateFreshCommand, MigrateStatusCommand, SeedCommand,
  MakeControllerCommand, MakeMiddlewareCommand, MakeMigrationCommand,
  MakeModelCommand, MakeSeederCommand, ServeCommand, RouteListCommand, TinkerCommand,
} from '@mantiq/cli'

const kernel = new Kernel()
kernel.registerAll([
  new MigrateCommand(), new MigrateRollbackCommand(), new MigrateResetCommand(),
  new MigrateFreshCommand(), new MigrateStatusCommand(), new SeedCommand(),
  new MakeControllerCommand(), new MakeMiddlewareCommand(), new MakeMigrationCommand(),
  new MakeModelCommand(), new MakeSeederCommand(),
  new AboutCommand(), new ServeCommand(), new RouteListCommand(), new TinkerCommand(),
])
const code = await kernel.run()
process.exit(code)
