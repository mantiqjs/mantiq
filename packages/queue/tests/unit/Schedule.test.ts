import { describe, test, expect } from 'bun:test'
import { Schedule, ScheduleEntry } from '../../src/schedule/Schedule.ts'
import { Job } from '../../src/Job.ts'

class ReportJob extends Job {
  override async handle(): Promise<void> {}
}

describe('ScheduleEntry', () => {
  test('everyMinute() matches any minute', () => {
    const entry = new ScheduleEntry('callback', () => {})
    entry.everyMinute()
    expect(entry.isDue(new Date(2026, 0, 1, 10, 30))).toBe(true)
    expect(entry.isDue(new Date(2026, 0, 1, 10, 0))).toBe(true)
  })

  test('everyFiveMinutes() matches at 0, 5, 10, ...', () => {
    const entry = new ScheduleEntry('callback', () => {})
    entry.everyFiveMinutes()
    expect(entry.isDue(new Date(2026, 0, 1, 10, 0))).toBe(true)
    expect(entry.isDue(new Date(2026, 0, 1, 10, 5))).toBe(true)
    expect(entry.isDue(new Date(2026, 0, 1, 10, 10))).toBe(true)
    expect(entry.isDue(new Date(2026, 0, 1, 10, 3))).toBe(false)
  })

  test('hourly() matches at minute 0', () => {
    const entry = new ScheduleEntry('callback', () => {})
    entry.hourly()
    expect(entry.isDue(new Date(2026, 0, 1, 10, 0))).toBe(true)
    expect(entry.isDue(new Date(2026, 0, 1, 10, 1))).toBe(false)
  })

  test('hourlyAt(30) matches at minute 30', () => {
    const entry = new ScheduleEntry('callback', () => {})
    entry.hourlyAt(30)
    expect(entry.isDue(new Date(2026, 0, 1, 10, 30))).toBe(true)
    expect(entry.isDue(new Date(2026, 0, 1, 10, 0))).toBe(false)
  })

  test('daily() matches at midnight', () => {
    const entry = new ScheduleEntry('callback', () => {})
    entry.daily()
    expect(entry.isDue(new Date(2026, 0, 1, 0, 0))).toBe(true)
    expect(entry.isDue(new Date(2026, 0, 1, 12, 0))).toBe(false)
  })

  test('dailyAt("14:30") matches at 2:30 PM', () => {
    const entry = new ScheduleEntry('callback', () => {})
    entry.dailyAt('14:30')
    expect(entry.isDue(new Date(2026, 0, 1, 14, 30))).toBe(true)
    expect(entry.isDue(new Date(2026, 0, 1, 14, 0))).toBe(false)
  })

  test('weekly() matches Sunday at midnight', () => {
    const entry = new ScheduleEntry('callback', () => {})
    entry.weekly()
    // Jan 4, 2026 is a Sunday
    expect(entry.isDue(new Date(2026, 0, 4, 0, 0))).toBe(true)
    // Jan 5, 2026 is a Monday
    expect(entry.isDue(new Date(2026, 0, 5, 0, 0))).toBe(false)
  })

  test('cron() sets arbitrary expression', () => {
    const entry = new ScheduleEntry('callback', () => {})
    entry.cron('15 3 * * 1') // 3:15 AM every Monday
    // Jan 5, 2026 is a Monday
    expect(entry.isDue(new Date(2026, 0, 5, 3, 15))).toBe(true)
    expect(entry.isDue(new Date(2026, 0, 5, 3, 16))).toBe(false)
  })

  test('cron with ranges', () => {
    const entry = new ScheduleEntry('callback', () => {})
    entry.cron('0 9-17 * * *') // Every hour from 9-17
    expect(entry.isDue(new Date(2026, 0, 1, 9, 0))).toBe(true)
    expect(entry.isDue(new Date(2026, 0, 1, 13, 0))).toBe(true)
    expect(entry.isDue(new Date(2026, 0, 1, 17, 0))).toBe(true)
    expect(entry.isDue(new Date(2026, 0, 1, 8, 0))).toBe(false)
    expect(entry.isDue(new Date(2026, 0, 1, 18, 0))).toBe(false)
  })

  test('cron with comma-separated values', () => {
    const entry = new ScheduleEntry('callback', () => {})
    entry.cron('0 6,12,18 * * *') // At 6, 12, 18
    expect(entry.isDue(new Date(2026, 0, 1, 6, 0))).toBe(true)
    expect(entry.isDue(new Date(2026, 0, 1, 12, 0))).toBe(true)
    expect(entry.isDue(new Date(2026, 0, 1, 18, 0))).toBe(true)
    expect(entry.isDue(new Date(2026, 0, 1, 7, 0))).toBe(false)
  })

  test('describedAs() sets description', () => {
    const entry = new ScheduleEntry('callback', () => {})
    entry.describedAs('Clean up temp files')
    expect(entry.description).toBe('Clean up temp files')
  })
})

describe('Schedule', () => {
  test('command() registers a command entry', () => {
    const schedule = new Schedule()
    const entry = schedule.command('cache:prune')
    entry.daily()

    expect(schedule.allEntries()).toHaveLength(1)
    expect(entry.type).toBe('command')
    expect(entry.value).toBe('cache:prune')
  })

  test('job() registers a job entry', () => {
    const schedule = new Schedule()
    const entry = schedule.job(ReportJob, { format: 'pdf' })
    entry.hourly()

    expect(schedule.allEntries()).toHaveLength(1)
    expect(entry.type).toBe('job')
    expect(entry.value).toBe(ReportJob)
    expect(entry.jobData).toEqual({ format: 'pdf' })
  })

  test('call() registers a callback entry', () => {
    const fn = () => console.log('hi')
    const schedule = new Schedule()
    const entry = schedule.call(fn)
    entry.everyMinute()

    expect(schedule.allEntries()).toHaveLength(1)
    expect(entry.type).toBe('callback')
    expect(entry.value).toBe(fn)
  })

  test('dueEntries() returns only due entries', () => {
    const schedule = new Schedule()
    schedule.command('always-due').everyMinute()
    schedule.command('never-due').cron('0 0 31 2 *') // Feb 31 = never

    const now = new Date(2026, 5, 15, 10, 30)
    const due = schedule.dueEntries(now)
    expect(due).toHaveLength(1)
  })

  test('multiple entries can be registered', () => {
    const schedule = new Schedule()
    schedule.command('one').daily()
    schedule.command('two').hourly()
    schedule.job(ReportJob).weekly()
    schedule.call(() => {}).everyFiveMinutes()

    expect(schedule.allEntries()).toHaveLength(4)
  })
})
