// @mantiq/queue — public API exports

// Core
export { Job } from './Job.ts'
export { QueueManager } from './QueueManager.ts'
export type { QueueConfig, QueueConnectionConfig } from './QueueManager.ts'
export { Worker } from './Worker.ts'
export type { WorkerOptions } from './Worker.ts'

// Dispatch
export { PendingDispatch } from './PendingDispatch.ts'
export { Chain } from './JobChain.ts'
export { Batch, PendingBatch } from './JobBatch.ts'

// Registry
export {
  registerJob,
  registerJobs,
  resolveJob,
  getRegisteredJobs,
  clearJobRegistry,
} from './JobRegistry.ts'

// Contracts
export type { QueueDriver } from './contracts/QueueDriver.ts'
export type {
  SerializedPayload,
  QueuedJob,
  FailedJob,
  BatchRecord,
  BatchOptions,
  Constructor,
} from './contracts/JobContract.ts'

// Drivers
export { SyncDriver } from './drivers/SyncDriver.ts'
export { SQLiteDriver } from './drivers/SQLiteDriver.ts'
export { RedisDriver } from './drivers/RedisDriver.ts'
export type { RedisQueueConfig } from './drivers/RedisDriver.ts'
export { SqsDriver } from './drivers/SqsDriver.ts'
export type { SqsQueueConfig } from './drivers/SqsDriver.ts'
export { KafkaDriver } from './drivers/KafkaDriver.ts'
export type { KafkaQueueConfig } from './drivers/KafkaDriver.ts'

// Events
export {
  JobProcessing,
  JobProcessed,
  JobFailed,
  JobExceptionOccurred,
} from './events/QueueEvents.ts'

// Errors
export {
  QueueError,
  JobTimeoutError,
  MaxAttemptsExceededError,
} from './errors/QueueError.ts'

// Helpers
export {
  dispatch,
  queue,
  Bus,
  QUEUE_MANAGER,
  setQueueManager,
  getQueueManager,
} from './helpers/queue.ts'

// Service Provider
export { QueueServiceProvider, createQueueManager } from './QueueServiceProvider.ts'

// Schedule
export { Schedule, ScheduleEntry } from './schedule/Schedule.ts'

// Testing
export { QueueFake } from './testing/QueueFake.ts'

// Commands
export { QueueWorkCommand } from './commands/QueueWorkCommand.ts'
export { QueueRetryCommand } from './commands/QueueRetryCommand.ts'
export { QueueFailedCommand } from './commands/QueueFailedCommand.ts'
export { QueueFlushCommand } from './commands/QueueFlushCommand.ts'
export { MakeJobCommand } from './commands/MakeJobCommand.ts'
export { ScheduleRunCommand } from './commands/ScheduleRunCommand.ts'
