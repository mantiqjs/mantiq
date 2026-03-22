import { ServiceProvider } from '@mantiq/core'
import { registerCommands } from '@mantiq/cli'
import { QueueManager } from './QueueManager.ts'
import type { QueueConfig, QueueConnectionConfig } from './QueueManager.ts'
import { SyncDriver } from './drivers/SyncDriver.ts'
import { SQLiteDriver } from './drivers/SQLiteDriver.ts'
import { RedisDriver } from './drivers/RedisDriver.ts'
import { SqsDriver } from './drivers/SqsDriver.ts'
import { KafkaDriver } from './drivers/KafkaDriver.ts'
import { setQueueManager, QUEUE_MANAGER } from './helpers/queue.ts'
import { setPendingDispatchResolver } from './PendingDispatch.ts'
import { setChainResolver } from './JobChain.ts'
import { setBatchResolver } from './JobBatch.ts'
import { Schedule } from './schedule/Schedule.ts'
import { QueueWorkCommand } from './commands/QueueWorkCommand.ts'
import { QueueRetryCommand } from './commands/QueueRetryCommand.ts'
import { QueueFailedCommand } from './commands/QueueFailedCommand.ts'
import { QueueFlushCommand } from './commands/QueueFlushCommand.ts'
import { ScheduleRunCommand } from './commands/ScheduleRunCommand.ts'

/**
 * Registers the QueueManager in the container and wires up helpers.
 *
 * @example — with @mantiq/core:
 * ```ts
 * // In your app's providers array:
 * providers: [QueueServiceProvider]
 * ```
 */
export class QueueServiceProvider extends ServiceProvider {
  override register(): void {
    this.app.singleton(QueueManager, () => {
      const config: QueueConfig = (this.app as any).config?.().get?.('queue') ?? {
        default: 'sync',
        connections: {
          sync: { driver: 'sync' },
        },
      }

      const builtInDrivers = new Map<string, (cfg: QueueConnectionConfig) => any>([
        ['sync', () => new SyncDriver()],
        ['sqlite', (cfg) => new SQLiteDriver(cfg.database ?? 'queue.sqlite')],
        ['redis', (cfg) => new RedisDriver(cfg as any)],
        ['sqs', (cfg) => new SqsDriver(cfg as any)],
        ['kafka', (cfg) => new KafkaDriver(cfg as any)],
      ])

      const manager = new QueueManager(config, builtInDrivers)

      // Wire up helpers
      setQueueManager(manager)
      setPendingDispatchResolver(() => manager)
      setChainResolver(() => manager)
      setBatchResolver(() => manager)

      return manager
    })

    // Also register under the symbol for container lookups
    this.app.singleton(QUEUE_MANAGER as any, () => {
      return this.app.make(QueueManager)
    })

    // Register a Schedule singleton for the schedule:run command
    this.app.singleton(Schedule, () => new Schedule())
  }

  override boot(): void {
    // Wire up the event dispatcher if available
    try {
      const dispatcher = (this.app as any).make?.('events') ?? null
      if (dispatcher) {
        QueueManager._dispatcher = dispatcher
      }
    } catch {
      // Events package not installed — fine, events are optional
    }

    // Register queue CLI commands via the CommandRegistry
    const manager = this.app.make(QueueManager) as QueueManager
    const schedule = this.app.make(Schedule) as Schedule

    registerCommands([
      new QueueWorkCommand(manager),
      new QueueRetryCommand(manager),
      new QueueFailedCommand(manager),
      new QueueFlushCommand(manager),
      new ScheduleRunCommand(schedule),
    ])
  }
}

/**
 * Standalone factory for using @mantiq/queue without @mantiq/core.
 */
export function createQueueManager(config: QueueConfig): QueueManager {
  const builtInDrivers = new Map<string, (cfg: QueueConnectionConfig) => any>([
    ['sync', () => new SyncDriver()],
    ['sqlite', (cfg) => new SQLiteDriver(cfg.database ?? 'queue.sqlite')],
  ])

  const manager = new QueueManager(config, builtInDrivers)

  setQueueManager(manager)
  setPendingDispatchResolver(() => manager)
  setChainResolver(() => manager)
  setBatchResolver(() => manager)

  return manager
}
