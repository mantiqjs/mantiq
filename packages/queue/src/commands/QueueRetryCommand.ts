import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'
import type { QueueManager } from '../QueueManager.ts'

export class QueueRetryCommand extends Command {
  override name = 'queue:retry'
  override description = 'Retry failed job(s)'
  override usage = 'queue:retry <id|all>'

  constructor(private readonly manager: QueueManager) {
    super()
  }

  override async handle(args: ParsedArgs): Promise<number> {
    const target = args.args[0]
    if (!target) {
      this.io.error('Please provide a failed job ID or "all".')
      return 1
    }

    const driver = this.manager.driver()

    if (target === 'all') {
      const failed = await driver.getFailedJobs()
      if (failed.length === 0) {
        this.io.info('No failed jobs to retry.')
        return 0
      }

      for (const job of failed) {
        await driver.push(job.payload, job.queue)
        await driver.forgetFailedJob(job.id)
      }

      this.io.success(`Retried ${failed.length} failed job(s).`)
      return 0
    }

    const id = isNaN(Number(target)) ? target : Number(target)
    const job = await driver.findFailedJob(id)
    if (!job) {
      this.io.error(`Failed job [${target}] not found.`)
      return 1
    }

    await driver.push(job.payload, job.queue)
    await driver.forgetFailedJob(job.id)

    this.io.success(`Retried failed job [${target}].`)
    return 0
  }
}
