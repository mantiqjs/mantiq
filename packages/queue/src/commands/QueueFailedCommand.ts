import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'
import type { QueueManager } from '../QueueManager.ts'

export class QueueFailedCommand extends Command {
  override name = 'queue:failed'
  override description = 'List all failed jobs'

  constructor(private readonly manager: QueueManager) {
    super()
  }

  override async handle(_args: ParsedArgs): Promise<number> {
    const driver = this.manager.driver()
    const failed = await driver.getFailedJobs()

    if (failed.length === 0) {
      this.io.info('No failed jobs.')
      return 0
    }

    // Table header
    const header = ['ID', 'Queue', 'Job', 'Failed At', 'Error']
    const rows = failed.map((j) => [
      String(j.id),
      j.queue,
      j.payload.jobName,
      new Date(j.failedAt * 1000).toISOString(),
      j.exception.split('\n')[0] ?? '',
    ])

    // Simple table output
    const colWidths = header.map((h, i) => {
      return Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length))
    })

    const separator = colWidths.map((w) => '-'.repeat(w + 2)).join('+')
    const formatRow = (row: string[]) =>
      row.map((cell, i) => ` ${cell.padEnd(colWidths[i]!)} `).join('|')

    console.log(formatRow(header))
    console.log(separator)
    for (const row of rows) {
      console.log(formatRow(row))
    }

    console.log(`\n${failed.length} failed job(s) total.`)
    return 0
  }
}
