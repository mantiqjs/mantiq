import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'
import type { QueueManager } from '../QueueManager.ts'

export class QueueFlushCommand extends Command {
  override name = 'queue:flush'
  override description = 'Delete all failed jobs'

  constructor(private readonly manager: QueueManager) {
    super()
  }

  override async handle(_args: ParsedArgs): Promise<number> {
    const driver = this.manager.driver()
    await driver.flushFailedJobs()
    this.io.success('All failed jobs deleted.')
    return 0
  }
}
