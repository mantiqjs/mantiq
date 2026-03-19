import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'
import { Schedule } from '../schedule/Schedule.ts'
import { dispatch } from '../helpers/queue.ts'
import { Job } from '../Job.ts'
import type { Constructor } from '../contracts/JobContract.ts'

export class ScheduleRunCommand extends Command {
  override name = 'schedule:run'
  override description = 'Run due scheduled entries'

  constructor(private readonly schedule: Schedule) {
    super()
  }

  override async handle(_args: ParsedArgs): Promise<number> {
    const due = this.schedule.dueEntries()

    if (due.length === 0) {
      this.io.info('No scheduled entries are due.')
      return 0
    }

    for (const entry of due) {
      const desc = entry.description || entry.expression
      try {
        switch (entry.type) {
          case 'command':
            this.io.info(`Running command: ${entry.value as string}`)
            // Commands are executed by the CLI kernel — we just log here.
            // In a full implementation, this would call the CLI kernel's dispatch.
            break

          case 'job': {
            const JobClass = entry.value as Constructor<Job>
            const job = Object.assign(new (JobClass as any)(), entry.jobData ?? {}) as Job
            this.io.info(`Dispatching job: ${JobClass.name}`)
            await dispatch(job)
            break
          }

          case 'callback': {
            this.io.info(`Running callback: ${desc}`)
            const callback = entry.value as () => any
            await callback()
            break
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        this.io.error(`Failed to run scheduled entry [${desc}]: ${msg}`)
      }
    }

    this.io.success(`Ran ${due.length} scheduled entry/entries.`)
    return 0
  }
}
