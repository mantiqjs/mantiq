import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'
import { Worker } from '../Worker.ts'
import type { QueueManager } from '../QueueManager.ts'

export class QueueWorkCommand extends Command {
  override name = 'queue:work'
  override description = 'Start processing jobs on the queue'
  override usage = 'queue:work [--queue=default] [--sleep=3] [--tries=3] [--timeout=60] [--stop-when-empty] [--max-jobs=0] [--max-time=0] [--connection=]'

  constructor(private readonly manager: QueueManager) {
    super()
  }

  override async handle(args: ParsedArgs): Promise<number> {
    const options = {
      queue: String(args.flags['queue'] ?? 'default'),
      sleep: Number(args.flags['sleep'] ?? 3),
      tries: Number(args.flags['tries'] ?? 3),
      timeout: Number(args.flags['timeout'] ?? 60),
      stopWhenEmpty: Boolean(args.flags['stop-when-empty']),
      maxJobs: Number(args.flags['max-jobs'] ?? 0) || undefined,
      maxTime: Number(args.flags['max-time'] ?? 0) || undefined,
      connection: args.flags['connection'] ? String(args.flags['connection']) : undefined,
    }

    this.io.info(`Processing jobs on queue [${options.queue}]...`)

    const worker = new Worker(this.manager, options)

    // Graceful shutdown on SIGINT/SIGTERM
    const shutdown = () => {
      this.io.info('Shutting down worker...')
      worker.stop()
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    try {
      await worker.run()
    } finally {
      process.off('SIGINT', shutdown)
      process.off('SIGTERM', shutdown)
    }

    this.io.success(`Worker stopped. Processed ${worker.getJobsProcessed()} job(s).`)
    return 0
  }
}
