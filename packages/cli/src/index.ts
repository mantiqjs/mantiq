// @mantiq/cli — public API exports

// Core
export { Command } from './Command.ts'
export { Kernel } from './Kernel.ts'
export { IO } from './IO.ts'
export { parse } from './Parser.ts'
export type { ParsedArgs } from './Parser.ts'

// Command Registry (service providers register commands here)
export { registerCommand, registerCommands, getRegisteredCommands, clearRegisteredCommands } from './CommandRegistry.ts'

// Base
export { GeneratorCommand } from './commands/GeneratorCommand.ts'

// Database commands
export { MigrateCommand } from './commands/MigrateCommand.ts'
export { MigrateRollbackCommand } from './commands/MigrateRollbackCommand.ts'
export { MigrateResetCommand } from './commands/MigrateResetCommand.ts'
export { MigrateFreshCommand } from './commands/MigrateFreshCommand.ts'
export { MigrateStatusCommand } from './commands/MigrateStatusCommand.ts'
export { SeedCommand } from './commands/SeedCommand.ts'

// Generator commands
export { MakeCommandCommand } from './commands/MakeCommandCommand.ts'
export { MakeControllerCommand } from './commands/MakeControllerCommand.ts'
export { MakeEventCommand } from './commands/MakeEventCommand.ts'
export { MakeExceptionCommand } from './commands/MakeExceptionCommand.ts'
export { MakeFactoryCommand } from './commands/MakeFactoryCommand.ts'
export { MakeListenerCommand } from './commands/MakeListenerCommand.ts'
export { MakeMiddlewareCommand } from './commands/MakeMiddlewareCommand.ts'
export { MakeMigrationCommand } from './commands/MakeMigrationCommand.ts'
export { MakeModelCommand } from './commands/MakeModelCommand.ts'
export { MakeObserverCommand } from './commands/MakeObserverCommand.ts'
export { MakeProviderCommand } from './commands/MakeProviderCommand.ts'
export { MakeRequestCommand } from './commands/MakeRequestCommand.ts'
export { MakeRuleCommand } from './commands/MakeRuleCommand.ts'
export { MakeSeederCommand } from './commands/MakeSeederCommand.ts'
export { MakeTestCommand } from './commands/MakeTestCommand.ts'
export { MakeMailCommand } from './commands/MakeMailCommand.ts'
export { MakeNotificationCommand } from './commands/MakeNotificationCommand.ts'
export { MakeJobCommand } from './commands/MakeJobCommand.ts'
export { MakePolicyCommand } from './commands/MakePolicyCommand.ts'

// Utility commands
export { AboutCommand } from './commands/AboutCommand.ts'
export { ServeCommand } from './commands/ServeCommand.ts'
export { RouteListCommand } from './commands/RouteListCommand.ts'
export { TinkerCommand } from './commands/TinkerCommand.ts'
export { OptimizeCommand, OptimizeClearCommand } from './commands/OptimizeCommand.ts'
