/**
 * Number formatting and math utilities.
 *
 * @example
 * ```ts
 * Num.format(1234567.89)           // '1,234,567.89'
 * Num.currency(99.99)              // '$99.99'
 * Num.abbreviate(1_500_000)        // '1.5M'
 * Num.fileSize(1_048_576)          // '1 MB'
 * Num.ordinal(3)                   // '3rd'
 * Num.clamp(150, 0, 100)           // 100
 * ```
 */
export const Num = {
  /** Format a number with thousand separators */
  format(value: number, decimals = 2, locale = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(value)
  },

  /** Format as currency */
  currency(value: number, currency = 'USD', locale = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(value)
  },

  /** Format as percentage */
  percentage(value: number, decimals = 0, locale = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value / 100)
  },

  /** Abbreviate large numbers (1K, 1.5M, 2.3B, etc.) */
  abbreviate(value: number, decimals = 1): string {
    const abs = Math.abs(value)
    const sign = value < 0 ? '-' : ''

    if (abs >= 1e15) return sign + (abs / 1e15).toFixed(decimals) + 'Q'
    if (abs >= 1e12) return sign + (abs / 1e12).toFixed(decimals) + 'T'
    if (abs >= 1e9) return sign + (abs / 1e9).toFixed(decimals) + 'B'
    if (abs >= 1e6) return sign + (abs / 1e6).toFixed(decimals) + 'M'
    if (abs >= 1e3) return sign + (abs / 1e3).toFixed(decimals) + 'K'
    return String(value)
  },

  /** Get the ordinal suffix (1st, 2nd, 3rd, 4th, ...) */
  ordinal(value: number): string {
    const abs = Math.abs(value)
    const mod100 = abs % 100
    if (mod100 >= 11 && mod100 <= 13) return `${value}th`
    const mod10 = abs % 10
    if (mod10 === 1) return `${value}st`
    if (mod10 === 2) return `${value}nd`
    if (mod10 === 3) return `${value}rd`
    return `${value}th`
  },

  /** Format bytes as human-readable file size */
  fileSize(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB']
    const k = 1024
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k))
    const unit = units[Math.min(i, units.length - 1)]
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + unit
  },

  /** Clamp a number within a range */
  clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
  },

  /** Check if value is between min and max (inclusive) */
  between(value: number, min: number, max: number): boolean {
    return value >= min && value <= max
  },

  /** Random integer between min and max (inclusive) */
  random(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  },

  /** Random float between min and max */
  randomFloat(min: number, max: number, decimals = 2): number {
    const value = Math.random() * (max - min) + min
    return parseFloat(value.toFixed(decimals))
  },

  /** Round to a given number of decimal places */
  round(value: number, precision = 0): number {
    const multiplier = Math.pow(10, precision)
    return Math.round(value * multiplier) / multiplier
  },

  /** Floor to a given precision */
  floor(value: number, precision = 0): number {
    const multiplier = Math.pow(10, precision)
    return Math.floor(value * multiplier) / multiplier
  },

  /** Ceil to a given precision */
  ceil(value: number, precision = 0): number {
    const multiplier = Math.pow(10, precision)
    return Math.ceil(value * multiplier) / multiplier
  },

  /** Linear interpolation between two values */
  lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t
  },

  /** Inverse lerp: find t given a value between start and end */
  inverseLerp(start: number, end: number, value: number): number {
    if (start === end) return 0
    return (value - start) / (end - start)
  },

  /** Map a value from one range to another */
  map(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin)
  },

  /** Sum of an array of numbers */
  sum(values: number[]): number {
    return values.reduce((a, b) => a + b, 0)
  },

  /** Average of an array of numbers */
  avg(values: number[]): number {
    if (values.length === 0) return 0
    return Num.sum(values) / values.length
  },

  /** Median of an array of numbers */
  median(values: number[]): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 !== 0
      ? sorted[mid]!
      : (sorted[mid - 1]! + sorted[mid]!) / 2
  },

  /** Mode (most frequent value) */
  mode(values: number[]): number | undefined {
    if (values.length === 0) return undefined
    const counts = new Map<number, number>()
    let maxCount = 0
    let maxValue = values[0]!
    for (const v of values) {
      const count = (counts.get(v) ?? 0) + 1
      counts.set(v, count)
      if (count > maxCount) {
        maxCount = count
        maxValue = v
      }
    }
    return maxValue
  },

  /** Standard deviation */
  stddev(values: number[]): number {
    if (values.length === 0) return 0
    const mean = Num.avg(values)
    const squareDiffs = values.map((v) => Math.pow(v - mean, 2))
    return Math.sqrt(Num.avg(squareDiffs))
  },

  /** Percentile (0-100) */
  percentile(values: number[], p: number): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const idx = (p / 100) * (sorted.length - 1)
    const lower = Math.floor(idx)
    const upper = Math.ceil(idx)
    if (lower === upper) return sorted[lower]!
    const frac = idx - lower
    return sorted[lower]! * (1 - frac) + sorted[upper]! * frac
  },
}
