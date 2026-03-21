import { describe, test, expect } from 'bun:test'
import { Schedule, ScheduleEntry } from '../../src/schedule/Schedule.ts'
import { Job } from '../../src/Job.ts'

// A dummy job for schedule.job() tests
class ReportJob extends Job {
  override async handle(): Promise<void> {}
}

describe('Schedule + ScheduleEntry (integration)', () => {
  // ── isDue() with known dates ────────────────────────────────────

  describe('ScheduleEntry.isDue()', () => {
    test('everyMinute() is always due', () => {
      const entry = new ScheduleEntry('callback', () => {})
      entry.everyMinute()

      // Test at several different times
      expect(entry.isDue(new Date('2026-03-21T00:00:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T12:30:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T23:59:00'))).toBe(true)
    })

    test('everyFiveMinutes() matches only multiples of 5', () => {
      const entry = new ScheduleEntry('callback', () => {})
      entry.everyFiveMinutes()

      expect(entry.isDue(new Date('2026-03-21T10:00:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T10:05:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T10:10:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T10:03:00'))).toBe(false)
      expect(entry.isDue(new Date('2026-03-21T10:07:00'))).toBe(false)
    })

    test('everyTenMinutes() matches multiples of 10', () => {
      const entry = new ScheduleEntry('callback', () => {})
      entry.everyTenMinutes()

      expect(entry.isDue(new Date('2026-03-21T10:00:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T10:10:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T10:20:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T10:05:00'))).toBe(false)
    })

    test('everyFifteenMinutes() matches multiples of 15', () => {
      const entry = new ScheduleEntry('callback', () => {})
      entry.everyFifteenMinutes()

      expect(entry.isDue(new Date('2026-03-21T10:00:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T10:15:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T10:30:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T10:45:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T10:12:00'))).toBe(false)
    })

    test('everyThirtyMinutes() matches 0 and 30', () => {
      const entry = new ScheduleEntry('callback', () => {})
      entry.everyThirtyMinutes()

      expect(entry.isDue(new Date('2026-03-21T10:00:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T10:30:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T10:15:00'))).toBe(false)
    })

    test('hourly() matches at minute 0 of every hour', () => {
      const entry = new ScheduleEntry('callback', () => {})
      entry.hourly()

      expect(entry.isDue(new Date('2026-03-21T00:00:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T13:00:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T13:01:00'))).toBe(false)
      expect(entry.isDue(new Date('2026-03-21T13:30:00'))).toBe(false)
    })

    test('hourlyAt(15) matches at minute 15 of every hour', () => {
      const entry = new ScheduleEntry('callback', () => {})
      entry.hourlyAt(15)

      expect(entry.isDue(new Date('2026-03-21T09:15:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T23:15:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T09:00:00'))).toBe(false)
    })

    test('daily() matches at midnight only', () => {
      const entry = new ScheduleEntry('callback', () => {})
      entry.daily()

      expect(entry.isDue(new Date('2026-03-21T00:00:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-22T00:00:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T12:00:00'))).toBe(false)
      expect(entry.isDue(new Date('2026-03-21T00:01:00'))).toBe(false)
    })

    test('dailyAt("14:30") matches at 14:30 only', () => {
      const entry = new ScheduleEntry('callback', () => {})
      entry.dailyAt('14:30')

      expect(entry.isDue(new Date('2026-03-21T14:30:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-22T14:30:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T14:31:00'))).toBe(false)
      expect(entry.isDue(new Date('2026-03-21T00:00:00'))).toBe(false)
    })

    test('twiceDaily(1, 13) matches at 01:00 and 13:00', () => {
      const entry = new ScheduleEntry('callback', () => {})
      entry.twiceDaily(1, 13)

      expect(entry.isDue(new Date('2026-03-21T01:00:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T13:00:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T02:00:00'))).toBe(false)
      expect(entry.isDue(new Date('2026-03-21T01:01:00'))).toBe(false)
    })

    test('weekly() matches Sunday at midnight', () => {
      const entry = new ScheduleEntry('callback', () => {})
      entry.weekly()

      // 2026-03-22 is a Sunday
      expect(entry.isDue(new Date('2026-03-22T00:00:00'))).toBe(true)
      // 2026-03-21 is a Saturday
      expect(entry.isDue(new Date('2026-03-21T00:00:00'))).toBe(false)
      // Sunday but wrong time
      expect(entry.isDue(new Date('2026-03-22T12:00:00'))).toBe(false)
    })

    test('weeklyOn(1, "9:0") matches Monday at 09:00', () => {
      const entry = new ScheduleEntry('callback', () => {})
      entry.weeklyOn(1, '9:0')

      // 2026-03-23 is a Monday
      expect(entry.isDue(new Date('2026-03-23T09:00:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-23T10:00:00'))).toBe(false)
      // 2026-03-24 is a Tuesday
      expect(entry.isDue(new Date('2026-03-24T09:00:00'))).toBe(false)
    })

    test('monthly() matches 1st of month at midnight', () => {
      const entry = new ScheduleEntry('callback', () => {})
      entry.monthly()

      expect(entry.isDue(new Date('2026-04-01T00:00:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-01-01T00:00:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-02T00:00:00'))).toBe(false)
      expect(entry.isDue(new Date('2026-04-01T00:01:00'))).toBe(false)
    })

    test('monthlyOn(15, "8:30") matches 15th at 08:30', () => {
      const entry = new ScheduleEntry('callback', () => {})
      entry.monthlyOn(15, '8:30')

      expect(entry.isDue(new Date('2026-03-15T08:30:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-04-15T08:30:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-16T08:30:00'))).toBe(false)
      expect(entry.isDue(new Date('2026-03-15T08:31:00'))).toBe(false)
    })

    test('yearly() matches January 1st at midnight', () => {
      const entry = new ScheduleEntry('callback', () => {})
      entry.yearly()

      expect(entry.isDue(new Date('2026-01-01T00:00:00'))).toBe(true)
      expect(entry.isDue(new Date('2027-01-01T00:00:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-02-01T00:00:00'))).toBe(false)
      expect(entry.isDue(new Date('2026-01-01T00:01:00'))).toBe(false)
    })

    test('cron() with raw expression', () => {
      const entry = new ScheduleEntry('callback', () => {})
      entry.cron('30 2 * * 1-5') // 02:30 on weekdays

      // 2026-03-23 is Monday
      expect(entry.isDue(new Date('2026-03-23T02:30:00'))).toBe(true)
      // 2026-03-24 is Tuesday
      expect(entry.isDue(new Date('2026-03-24T02:30:00'))).toBe(true)
      // 2026-03-22 is Sunday
      expect(entry.isDue(new Date('2026-03-22T02:30:00'))).toBe(false)
      // Right day, wrong time
      expect(entry.isDue(new Date('2026-03-23T03:30:00'))).toBe(false)
    })

    test('cron with comma-separated values', () => {
      const entry = new ScheduleEntry('callback', () => {})
      entry.cron('0,30 * * * *') // at minute 0 and 30

      expect(entry.isDue(new Date('2026-03-21T10:00:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T10:30:00'))).toBe(true)
      expect(entry.isDue(new Date('2026-03-21T10:15:00'))).toBe(false)
    })

    test('cron with range in day-of-week (1-5 = weekdays)', () => {
      const entry = new ScheduleEntry('callback', () => {})
      entry.cron('0 9 * * 1-5')

      // 2026-03-23 is Monday
      expect(entry.isDue(new Date('2026-03-23T09:00:00'))).toBe(true)
      // 2026-03-27 is Friday
      expect(entry.isDue(new Date('2026-03-27T09:00:00'))).toBe(true)
      // 2026-03-22 is Sunday
      expect(entry.isDue(new Date('2026-03-22T09:00:00'))).toBe(false)
      // 2026-03-28 is Saturday
      expect(entry.isDue(new Date('2026-03-28T09:00:00'))).toBe(false)
    })
  })

  // ── Schedule registry ──────────────────────────────────────────

  describe('Schedule', () => {
    test('command() registers a command entry', () => {
      const schedule = new Schedule()
      const entry = schedule.command('cache:prune')
      entry.daily()

      const all = schedule.allEntries()
      expect(all).toHaveLength(1)
      expect(all[0]!.type).toBe('command')
      expect(all[0]!.value).toBe('cache:prune')
      expect(all[0]!.expression).toBe('0 0 * * *')
    })

    test('job() registers a job entry', () => {
      const schedule = new Schedule()
      const entry = schedule.job(ReportJob, { type: 'weekly' })
      entry.weeklyOn(1, '6:0')

      const all = schedule.allEntries()
      expect(all).toHaveLength(1)
      expect(all[0]!.type).toBe('job')
      expect(all[0]!.value).toBe(ReportJob)
      expect(all[0]!.jobData).toEqual({ type: 'weekly' })
    })

    test('call() registers a callback entry', () => {
      const fn = () => console.log('heartbeat')
      const schedule = new Schedule()
      schedule.call(fn).everyFiveMinutes()

      const all = schedule.allEntries()
      expect(all).toHaveLength(1)
      expect(all[0]!.type).toBe('callback')
      expect(all[0]!.value).toBe(fn)
    })

    test('dueEntries() filters to only entries due at the given time', () => {
      const schedule = new Schedule()

      // This should be due at any minute
      schedule.command('always:run').everyMinute()

      // This should be due only at midnight
      schedule.command('midnight:only').daily()

      // This should be due only at 14:30
      schedule.command('afternoon:run').dailyAt('14:30')

      // Test at midnight
      const midnight = new Date('2026-03-21T00:00:00')
      const dueMidnight = schedule.dueEntries(midnight)
      expect(dueMidnight).toHaveLength(2)
      const dueNames = dueMidnight.map((e) => e.value)
      expect(dueNames).toContain('always:run')
      expect(dueNames).toContain('midnight:only')

      // Test at 14:30
      const afternoon = new Date('2026-03-21T14:30:00')
      const dueAfternoon = schedule.dueEntries(afternoon)
      expect(dueAfternoon).toHaveLength(2)
      const afternoonNames = dueAfternoon.map((e) => e.value)
      expect(afternoonNames).toContain('always:run')
      expect(afternoonNames).toContain('afternoon:run')

      // Test at 10:07 — only everyMinute
      const random = new Date('2026-03-21T10:07:00')
      const dueRandom = schedule.dueEntries(random)
      expect(dueRandom).toHaveLength(1)
      expect(dueRandom[0]!.value).toBe('always:run')
    })

    test('allEntries() returns copies of registered entries', () => {
      const schedule = new Schedule()
      schedule.command('a').daily()
      schedule.command('b').hourly()
      schedule.command('c').everyMinute()

      expect(schedule.allEntries()).toHaveLength(3)
    })

    test('describedAs() sets entry description', () => {
      const entry = new ScheduleEntry('command', 'test:cmd')
      entry.describedAs('Run the test command').daily()

      expect(entry.description).toBe('Run the test command')
    })

    test('multiple schedule registrations with complex patterns', () => {
      const schedule = new Schedule()

      schedule.command('report:daily').dailyAt('2:00')
      schedule.job(ReportJob).weeklyOn(1, '9:0')
      schedule.call(() => {}).everyFifteenMinutes()
      schedule.command('cleanup:temp').cron('0 3 * * 0')

      const all = schedule.allEntries()
      expect(all).toHaveLength(4)

      // Monday 2026-03-23 at 09:00
      const mondayMorning = new Date('2026-03-23T09:00:00')
      const dueMondayMorning = schedule.dueEntries(mondayMorning)

      const types = dueMondayMorning.map((e) => e.type)
      // everyFifteenMinutes (minute 0) and weeklyOn(1, '9:0')
      expect(types).toContain('callback')
      expect(types).toContain('job')
    })
  })
})
