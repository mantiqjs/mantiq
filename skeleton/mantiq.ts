#!/usr/bin/env bun
await import('./index.ts')

import { Kernel } from '@mantiq/cli'
import { Discoverer } from '@mantiq/core'
import {
  AboutCommand, ServeCommand, RouteListCommand, TinkerCommand,
  MigrateCommand, MigrateRollbackCommand, MigrateResetCommand,
  MigrateFreshCommand, MigrateStatusCommand, SeedCommand,
  MakeCommandCommand, MakeControllerCommand, MakeEventCommand,
  MakeExceptionCommand, MakeFactoryCommand, MakeListenerCommand,
  MakeMiddlewareCommand, MakeMigrationCommand, MakeModelCommand,
  MakeObserverCommand, MakeProviderCommand, MakeRequestCommand,
  MakeRuleCommand, MakeSeederCommand, MakeTestCommand,
  MakeJobCommand, MakeNotificationCommand, MakeMailCommand,
  MakePolicyCommand,
} from '@mantiq/cli'
import { InstallCommand as HeartbeatInstallCommand } from '@mantiq/heartbeat'

const kernel = new Kernel()

// Framework commands
kernel.registerAll([
  new MigrateCommand(), new MigrateRollbackCommand(), new MigrateResetCommand(),
  new MigrateFreshCommand(), new MigrateStatusCommand(), new SeedCommand(),
  new MakeCommandCommand(), new MakeControllerCommand(), new MakeEventCommand(),
  new MakeExceptionCommand(), new MakeFactoryCommand(), new MakeJobCommand(),
  new MakeListenerCommand(), new MakeMiddlewareCommand(), new MakeMigrationCommand(),
  new MakeModelCommand(), new MakeObserverCommand(), new MakeProviderCommand(),
  new MakeRequestCommand(), new MakeRuleCommand(), new MakeSeederCommand(),
  new MakeTestCommand(), new MakeMailCommand(), new MakeNotificationCommand(),
  new MakePolicyCommand(),
  new AboutCommand(), new ServeCommand(), new RouteListCommand(), new TinkerCommand(),
  new HeartbeatInstallCommand(),
])

// Auto-discover user commands from app/Console/Commands/
const discoverer = new Discoverer(process.cwd())
const manifest = await discoverer.resolve(process.env['APP_ENV'] !== 'production')
const userCommands = await discoverer.loadCommands(manifest)
for (const cmd of userCommands) kernel.register(cmd)

const code = await kernel.run()
process.exit(code)
