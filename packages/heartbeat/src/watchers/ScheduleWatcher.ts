import { Watcher } from '../contracts/Watcher.ts'
import type { ScheduleEntryContent } from '../contracts/Entry.ts'

/**
 * Records scheduled task executions.
 *
 * Driven directly by the schedule runner.
 */
export class ScheduleWatcher extends Watcher {
  override register(): void {
    // ScheduleWatcher is driven by wrapping the schedule executor.
    // HeartbeatServiceProvider hooks into Schedule.run().
  }

  recordSchedule(data: {
    command: string
    expression: string
    duration: number
    status: 'success' | 'error'
  }): void {
    if (!this.isEnabled()) return

    const content: ScheduleEntryContent = {
      command: data.command,
      expression: data.expression,
      duration: data.duration,
      status: data.status,
      output: null,
    }

    const tags: string[] = [data.status]
    if (data.status === 'error') tags.push('failed')

    this.record('schedule', content, tags)
  }
}
