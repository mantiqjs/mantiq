import { describe, expect, test } from 'bun:test'
import { Num } from '../../src/Num.ts'

describe('Num', () => {
  describe('format', () => {
    test('formats with thousand separators', () => {
      expect(Num.format(1234567.89)).toBe('1,234,567.89')
      expect(Num.format(1000)).toBe('1,000')
    })
  })

  describe('currency', () => {
    test('formats as currency', () => {
      expect(Num.currency(99.99)).toBe('$99.99')
      expect(Num.currency(99.99, 'EUR', 'de-DE')).toContain('99,99')
    })
  })

  describe('percentage', () => {
    test('formats as percentage', () => {
      expect(Num.percentage(75)).toBe('75%')
      expect(Num.percentage(33.333, 1)).toBe('33.3%')
    })
  })

  describe('abbreviate', () => {
    test('abbreviates large numbers', () => {
      expect(Num.abbreviate(1500)).toBe('1.5K')
      expect(Num.abbreviate(1_500_000)).toBe('1.5M')
      expect(Num.abbreviate(2_300_000_000)).toBe('2.3B')
      expect(Num.abbreviate(500)).toBe('500')
    })
  })

  describe('ordinal', () => {
    test('returns ordinal suffix', () => {
      expect(Num.ordinal(1)).toBe('1st')
      expect(Num.ordinal(2)).toBe('2nd')
      expect(Num.ordinal(3)).toBe('3rd')
      expect(Num.ordinal(4)).toBe('4th')
      expect(Num.ordinal(11)).toBe('11th')
      expect(Num.ordinal(12)).toBe('12th')
      expect(Num.ordinal(13)).toBe('13th')
      expect(Num.ordinal(21)).toBe('21st')
    })
  })

  describe('fileSize', () => {
    test('formats bytes as file size', () => {
      expect(Num.fileSize(0)).toBe('0 B')
      expect(Num.fileSize(1024)).toBe('1 KB')
      expect(Num.fileSize(1_048_576)).toBe('1 MB')
      expect(Num.fileSize(1_073_741_824)).toBe('1 GB')
    })
  })

  describe('clamp', () => {
    test('clamps values', () => {
      expect(Num.clamp(150, 0, 100)).toBe(100)
      expect(Num.clamp(-10, 0, 100)).toBe(0)
      expect(Num.clamp(50, 0, 100)).toBe(50)
    })
  })

  describe('between', () => {
    test('checks range', () => {
      expect(Num.between(5, 1, 10)).toBe(true)
      expect(Num.between(15, 1, 10)).toBe(false)
    })
  })

  describe('random', () => {
    test('generates random in range', () => {
      const val = Num.random(1, 10)
      expect(val).toBeGreaterThanOrEqual(1)
      expect(val).toBeLessThanOrEqual(10)
      expect(Number.isInteger(val)).toBe(true)
    })
  })

  describe('round / floor / ceil', () => {
    test('round', () => {
      expect(Num.round(1.2345, 2)).toBe(1.23)
      expect(Num.round(1.235, 2)).toBe(1.24)
    })

    test('floor', () => {
      expect(Num.floor(1.999, 1)).toBe(1.9)
    })

    test('ceil', () => {
      expect(Num.ceil(1.001, 1)).toBe(1.1)
    })
  })

  describe('lerp / inverseLerp', () => {
    test('lerp', () => {
      expect(Num.lerp(0, 100, 0.5)).toBe(50)
      expect(Num.lerp(0, 100, 0)).toBe(0)
      expect(Num.lerp(0, 100, 1)).toBe(100)
    })

    test('inverseLerp', () => {
      expect(Num.inverseLerp(0, 100, 50)).toBe(0.5)
    })
  })

  describe('statistics', () => {
    test('sum', () => {
      expect(Num.sum([1, 2, 3, 4])).toBe(10)
    })

    test('avg', () => {
      expect(Num.avg([2, 4, 6])).toBe(4)
      expect(Num.avg([])).toBe(0)
    })

    test('median', () => {
      expect(Num.median([1, 3, 5])).toBe(3)
      expect(Num.median([1, 2, 3, 4])).toBe(2.5)
    })

    test('mode', () => {
      expect(Num.mode([1, 2, 2, 3])).toBe(2)
    })

    test('stddev', () => {
      expect(Num.stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 0)
    })

    test('percentile', () => {
      expect(Num.percentile([1, 2, 3, 4, 5], 50)).toBe(3)
    })
  })
})
