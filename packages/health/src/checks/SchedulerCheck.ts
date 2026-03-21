import { HealthCheck } from '../HealthCheck.ts'

/**
 * Verifies scheduled tasks are registered and the scheduler is running.
 */
export class SchedulerCheck extends HealthCheck {
  readonly name = 'scheduler'

  constructor(private scheduler: any) {
    super()
  }

  override async run(): Promise<void> {
    if (!this.scheduler) throw new Error('Scheduler instance is null')

    const tasks = this.scheduler.events?.() ?? this.scheduler.tasks ?? []
    const count = Array.isArray(tasks) ? tasks.length : 0
    this.meta('tasks', count)

    if (count === 0) {
      this.degrade('No scheduled tasks registered')
    }
  }
}
