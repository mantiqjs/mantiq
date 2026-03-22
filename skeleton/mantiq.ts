#!/usr/bin/env bun
await import('./index.ts')

import { Kernel } from '@mantiq/cli'
import {
  AboutCommand,
  MigrateCommand,
  MigrateRollbackCommand,
  MigrateResetCommand,
  MigrateFreshCommand,
  MigrateStatusCommand,
  SeedCommand,
  MakeCommandCommand,
  MakeControllerCommand,
  MakeEventCommand,
  MakeExceptionCommand,
  MakeFactoryCommand,
  MakeListenerCommand,
  MakeMiddlewareCommand,
  MakeMigrationCommand,
  MakeModelCommand,
  MakeObserverCommand,
  MakeProviderCommand,
  MakeRequestCommand,
  MakeRuleCommand,
  MakeSeederCommand,
  MakeTestCommand,
  ServeCommand,
  RouteListCommand,
  TinkerCommand,
} from '@mantiq/cli'
import {
  QueueWorkCommand,
  QueueRetryCommand,
  QueueFailedCommand,
  QueueFlushCommand,
  MakeJobCommand,
  ScheduleRunCommand,
} from '@mantiq/queue'
import { InstallCommand as HeartbeatInstallCommand } from '@mantiq/heartbeat'
import { MakeMailCommand } from '@mantiq/mail'
import { MakeNotificationCommand } from '@mantiq/notify'
import { MakePolicyCommand } from '@mantiq/cli'

const kernel = new Kernel()

kernel.registerAll([
  // Database
  new MigrateCommand(),
  new MigrateRollbackCommand(),
  new MigrateResetCommand(),
  new MigrateFreshCommand(),
  new MigrateStatusCommand(),
  new SeedCommand(),

  // Code generators
  new MakeCommandCommand(),
  new MakeControllerCommand(),
  new MakeEventCommand(),
  new MakeExceptionCommand(),
  new MakeFactoryCommand(),
  new MakeJobCommand(),
  new MakeListenerCommand(),
  new MakeMiddlewareCommand(),
  new MakeMigrationCommand(),
  new MakeModelCommand(),
  new MakeObserverCommand(),
  new MakeProviderCommand(),
  new MakeRequestCommand(),
  new MakeRuleCommand(),
  new MakeSeederCommand(),
  new MakeTestCommand(),
  new MakeMailCommand(),
  new MakeNotificationCommand(),
  new MakePolicyCommand(),

  // Queue
  new QueueWorkCommand(),
  new QueueRetryCommand(),
  new QueueFailedCommand(),
  new QueueFlushCommand(),
  new ScheduleRunCommand(),

  // Utilities
  new AboutCommand(),
  new ServeCommand(),
  new RouteListCommand(),
  new TinkerCommand(),

  // Heartbeat
  new HeartbeatInstallCommand(),
])

const code = await kernel.run()
process.exit(code)
