import type { Job } from '../Job.ts'
import type { Constructor } from '../contracts/JobContract.ts'

/**
 * A single scheduled entry — wraps a command, job, or callback
 * with a cron-like schedule expression.
 */
export class ScheduleEntry {
  private cronExpression = '* * * * *'
  private _description = ''
  private _type: 'command' | 'job' | 'callback'
  private _value: string | Constructor<Job> | (() => any)
  private _jobData?: Record<string, any> | undefined

  constructor(type: 'command' | 'job' | 'callback', value: string | Constructor<Job> | (() => any), jobData?: Record<string, any>) {
    this._type = type
    this._value = value
    this._jobData = jobData
  }

  get type() { return this._type }
  get value() { return this._value }
  get jobData() { return this._jobData }
  get description() { return this._description }
  get expression() { return this.cronExpression }

  // ── Frequency helpers ────────────────────────────────────────────

  /** Run every minute */
  everyMinute(): this {
    this.cronExpression = '* * * * *'
    return this
  }

  /** Run every 5 minutes */
  everyFiveMinutes(): this {
    this.cronExpression = '*/5 * * * *'
    return this
  }

  /** Run every 10 minutes */
  everyTenMinutes(): this {
    this.cronExpression = '*/10 * * * *'
    return this
  }

  /** Run every 15 minutes */
  everyFifteenMinutes(): this {
    this.cronExpression = '*/15 * * * *'
    return this
  }

  /** Run every 30 minutes */
  everyThirtyMinutes(): this {
    this.cronExpression = '*/30 * * * *'
    return this
  }

  /** Run once per hour at minute 0 */
  hourly(): this {
    this.cronExpression = '0 * * * *'
    return this
  }

  /** Run once per hour at a specific minute */
  hourlyAt(minute: number): this {
    this.cronExpression = `${minute} * * * *`
    return this
  }

  /** Run once per day at midnight */
  daily(): this {
    this.cronExpression = '0 0 * * *'
    return this
  }

  /** Run daily at a specific time (HH:MM) */
  dailyAt(time: string): this {
    const [hours, minutes] = time.split(':').map(Number)
    this.cronExpression = `${minutes ?? 0} ${hours ?? 0} * * *`
    return this
  }

  /** Run twice daily at the given hours */
  twiceDaily(hour1 = 1, hour2 = 13): this {
    this.cronExpression = `0 ${hour1},${hour2} * * *`
    return this
  }

  /** Run once per week on Sunday at midnight */
  weekly(): this {
    this.cronExpression = '0 0 * * 0'
    return this
  }

  /** Run weekly on a specific day and time */
  weeklyOn(day: number, time = '0:0'): this {
    const [hours, minutes] = time.split(':').map(Number)
    this.cronExpression = `${minutes ?? 0} ${hours ?? 0} * * ${day}`
    return this
  }

  /** Run once per month on the 1st at midnight */
  monthly(): this {
    this.cronExpression = '0 0 1 * *'
    return this
  }

  /** Run monthly on a specific day and time */
  monthlyOn(day = 1, time = '0:0'): this {
    const [hours, minutes] = time.split(':').map(Number)
    this.cronExpression = `${minutes ?? 0} ${hours ?? 0} ${day} * *`
    return this
  }

  /** Run once per year on January 1st at midnight */
  yearly(): this {
    this.cronExpression = '0 0 1 1 *'
    return this
  }

  /** Set a raw cron expression */
  cron(expression: string): this {
    this.cronExpression = expression
    return this
  }

  /** Set a human-readable description */
  describedAs(description: string): this {
    this._description = description
    return this
  }

  /**
   * Check if this entry is due to run at a given date (defaults to now).
   * Matches minute, hour, day-of-month, month, and day-of-week.
   */
  isDue(now?: Date): boolean {
    const date = now ?? new Date()
    const parts = this.cronExpression.split(/\s+/)
    if (parts.length !== 5) return false

    const minute = date.getMinutes()
    const hour = date.getHours()
    const dayOfMonth = date.getDate()
    const month = date.getMonth() + 1
    const dayOfWeek = date.getDay()

    return (
      matchesCronField(parts[0]!, minute, 0, 59) &&
      matchesCronField(parts[1]!, hour, 0, 23) &&
      matchesCronField(parts[2]!, dayOfMonth, 1, 31) &&
      matchesCronField(parts[3]!, month, 1, 12) &&
      matchesCronField(parts[4]!, dayOfWeek, 0, 6)
    )
  }
}

/**
 * Schedule registry — collects commands, jobs, and callbacks
 * that should be run on a recurring basis.
 *
 * @example
 * ```ts
 * // routes/console.ts
 * import { schedule } from '@mantiq/queue'
 *
 * export default function (schedule: Schedule) {
 *   schedule.command('cache:prune').daily()
 *   schedule.job(ProcessReports).dailyAt('02:00')
 *   schedule.call(() => console.log('heartbeat')).everyFiveMinutes()
 * }
 * ```
 */
export class Schedule {
  private entries: ScheduleEntry[] = []

  /** Schedule an artisan/CLI command */
  command(name: string): ScheduleEntry {
    const entry = new ScheduleEntry('command', name)
    this.entries.push(entry)
    return entry
  }

  /** Schedule a queued job */
  job(jobClass: Constructor<Job>, data?: Record<string, any>): ScheduleEntry {
    const entry = new ScheduleEntry('job', jobClass, data)
    this.entries.push(entry)
    return entry
  }

  /** Schedule an arbitrary callback */
  call(callback: () => any): ScheduleEntry {
    const entry = new ScheduleEntry('callback', callback)
    this.entries.push(entry)
    return entry
  }

  /** Get all entries that are due at the given time (defaults to now) */
  dueEntries(now?: Date): ScheduleEntry[] {
    return this.entries.filter((e) => e.isDue(now))
  }

  /** Get all registered entries */
  allEntries(): ScheduleEntry[] {
    return [...this.entries]
  }
}

// ── Cron expression matching ──────────────────────────────────────

function matchesCronField(field: string, value: number, min: number, max: number): boolean {
  if (field === '*') return true

  // Handle comma-separated values: '1,15,30'
  if (field.includes(',')) {
    return field.split(',').some((part) => matchesCronField(part.trim(), value, min, max))
  }

  // Handle step values: '*/5', '1-30/5'
  if (field.includes('/')) {
    const [range, stepStr] = field.split('/')
    const step = parseInt(stepStr!, 10)
    if (isNaN(step) || step <= 0) return false

    let start = min
    let end = max
    if (range !== '*') {
      if (range!.includes('-')) {
        const [s, e] = range!.split('-').map(Number)
        start = s!
        end = e!
      } else {
        start = parseInt(range!, 10)
      }
    }

    for (let i = start; i <= end; i += step) {
      if (i === value) return true
    }
    return false
  }

  // Handle ranges: '1-5'
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number)
    return value >= start! && value <= end!
  }

  // Simple number
  return parseInt(field, 10) === value
}
