import { describe, expect, test } from 'bun:test'
import { Duration } from '../../src/Duration.ts'

describe('Duration', () => {
  describe('factories', () => {
    test('ms', () => {
      expect(Duration.ms(500).toMs()).toBe(500)
    })

    test('seconds', () => {
      expect(Duration.seconds(5).toMs()).toBe(5000)
    })

    test('minutes', () => {
      expect(Duration.minutes(2).toMs()).toBe(120_000)
    })

    test('hours', () => {
      expect(Duration.hours(1).toMs()).toBe(3_600_000)
    })

    test('days', () => {
      expect(Duration.days(1).toMs()).toBe(86_400_000)
    })

    test('weeks', () => {
      expect(Duration.weeks(1).toMs()).toBe(604_800_000)
    })
  })

  describe('parse', () => {
    test('parses compound strings', () => {
      expect(Duration.parse('2h30m').toMs()).toBe(9_000_000)
      expect(Duration.parse('1d12h').toMs()).toBe(129_600_000)
    })

    test('parses single units', () => {
      expect(Duration.parse('500ms').toMs()).toBe(500)
      expect(Duration.parse('2.5s').toMs()).toBe(2500)
    })

    test('parses plain number as ms', () => {
      expect(Duration.parse('1000').toMs()).toBe(1000)
    })
  })

  describe('between', () => {
    test('calculates duration between dates', () => {
      const start = new Date('2024-01-01T00:00:00Z')
      const end = new Date('2024-01-01T01:00:00Z')
      expect(Duration.between(start, end).toHours()).toBe(1)
    })
  })

  describe('arithmetic', () => {
    test('plus', () => {
      const result = Duration.minutes(5).plus(Duration.seconds(30))
      expect(result.toMs()).toBe(330_000)
    })

    test('minus (floors at 0)', () => {
      expect(Duration.seconds(10).minus(Duration.seconds(3)).toMs()).toBe(7000)
      expect(Duration.seconds(3).minus(Duration.seconds(10)).toMs()).toBe(0)
    })

    test('times', () => {
      expect(Duration.minutes(5).times(3).toMs()).toBe(900_000)
    })

    test('dividedBy', () => {
      expect(Duration.minutes(6).dividedBy(3).toMs()).toBe(120_000)
    })
  })

  describe('conversions', () => {
    test('toSeconds', () => {
      expect(Duration.ms(2500).toSeconds()).toBe(2.5)
    })

    test('toMinutes', () => {
      expect(Duration.seconds(90).toMinutes()).toBe(1.5)
    })

    test('toHours', () => {
      expect(Duration.minutes(90).toHours()).toBe(1.5)
    })

    test('toDays', () => {
      expect(Duration.hours(48).toDays()).toBe(2)
    })

    test('toWeeks', () => {
      expect(Duration.days(14).toWeeks()).toBe(2)
    })
  })

  describe('toComponents', () => {
    test('breaks down into parts', () => {
      const c = Duration.parse('1d2h30m15s500ms').toComponents()
      expect(c.days).toBe(1)
      expect(c.hours).toBe(2)
      expect(c.minutes).toBe(30)
      expect(c.seconds).toBe(15)
      expect(c.milliseconds).toBe(500)
    })
  })

  describe('toHuman', () => {
    test('human-readable string', () => {
      expect(Duration.hours(2).toHuman()).toBe('2 hours')
      expect(Duration.ms(90_000).toHuman()).toBe('1 minute, 30 seconds')
      expect(Duration.ms(0).toHuman()).toBe('0ms')
      expect(Duration.ms(500).toHuman()).toBe('500ms')
      expect(Duration.hours(1).toHuman()).toBe('1 hour')
    })
  })

  describe('toCompact', () => {
    test('compact string', () => {
      expect(Duration.parse('2h30m').toCompact()).toBe('2h30m')
      expect(Duration.ms(0).toCompact()).toBe('0ms')
    })
  })

  describe('toISO', () => {
    test('ISO 8601 duration', () => {
      expect(Duration.parse('2h30m').toISO()).toBe('PT2H30M')
      expect(Duration.days(1).toISO()).toBe('P1D')
      expect(Duration.ms(0).toISO()).toBe('PT0S')
    })
  })

  describe('comparisons', () => {
    test('isZero / isPositive', () => {
      expect(Duration.ms(0).isZero()).toBe(true)
      expect(Duration.ms(1).isPositive()).toBe(true)
    })

    test('greaterThan / lessThan / equals', () => {
      expect(Duration.seconds(10).greaterThan(Duration.seconds(5))).toBe(true)
      expect(Duration.seconds(5).lessThan(Duration.seconds(10))).toBe(true)
      expect(Duration.seconds(5).equals(Duration.seconds(5))).toBe(true)
    })
  })

  describe('date arithmetic', () => {
    test('addTo / subtractFrom', () => {
      const base = new Date('2024-01-01T00:00:00Z')
      const result = Duration.hours(2).addTo(base)
      expect(result.toISOString()).toBe('2024-01-01T02:00:00.000Z')

      const earlier = Duration.hours(1).subtractFrom(base)
      expect(earlier.toISOString()).toBe('2023-12-31T23:00:00.000Z')
    })

    test('fromNow / ago return dates', () => {
      const now = Date.now()
      const future = Duration.hours(1).fromNow()
      expect(future.getTime()).toBeGreaterThan(now)

      const past = Duration.hours(1).ago()
      expect(past.getTime()).toBeLessThan(now)
    })
  })
})
