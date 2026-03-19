/**
 * Fluent duration builder for human-readable time math.
 *
 * @example
 * ```ts
 * Duration.minutes(5).plus(Duration.seconds(30)).toMs()  // 330_000
 * Duration.hours(2).toHuman()                             // '2 hours'
 * Duration.ms(90_000).toHuman()                           // '1 minute, 30 seconds'
 * Duration.parse('2h30m').toSeconds()                     // 9000
 * ```
 */
export class Duration {
  private constructor(private readonly milliseconds: number) {}

  // ── Factories ───────────────────────────────────────────────────

  static ms(value: number): Duration { return new Duration(value) }
  static seconds(value: number): Duration { return new Duration(value * 1000) }
  static minutes(value: number): Duration { return new Duration(value * 60_000) }
  static hours(value: number): Duration { return new Duration(value * 3_600_000) }
  static days(value: number): Duration { return new Duration(value * 86_400_000) }
  static weeks(value: number): Duration { return new Duration(value * 604_800_000) }

  /** Parse a duration string like '2h30m', '1d12h', '500ms', '2.5s' */
  static parse(input: string): Duration {
    let totalMs = 0
    const regex = /(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)/gi
    let match: RegExpExecArray | null
    while ((match = regex.exec(input)) !== null) {
      const value = parseFloat(match[1]!)
      const unit = match[2]!.toLowerCase()
      switch (unit) {
        case 'ms': totalMs += value; break
        case 's': totalMs += value * 1000; break
        case 'm': totalMs += value * 60_000; break
        case 'h': totalMs += value * 3_600_000; break
        case 'd': totalMs += value * 86_400_000; break
        case 'w': totalMs += value * 604_800_000; break
      }
    }
    if (totalMs === 0 && /^\d+$/.test(input.trim())) {
      totalMs = parseInt(input.trim(), 10)
    }
    return new Duration(totalMs)
  }

  /** Create from a start and end date */
  static between(start: Date, end: Date): Duration {
    return new Duration(Math.abs(end.getTime() - start.getTime()))
  }

  // ── Arithmetic ──────────────────────────────────────────────────

  plus(other: Duration): Duration {
    return new Duration(this.milliseconds + other.milliseconds)
  }

  minus(other: Duration): Duration {
    return new Duration(Math.max(0, this.milliseconds - other.milliseconds))
  }

  times(factor: number): Duration {
    return new Duration(this.milliseconds * factor)
  }

  dividedBy(divisor: number): Duration {
    return new Duration(Math.floor(this.milliseconds / divisor))
  }

  // ── Conversions ─────────────────────────────────────────────────

  toMs(): number { return this.milliseconds }
  toSeconds(): number { return this.milliseconds / 1000 }
  toMinutes(): number { return this.milliseconds / 60_000 }
  toHours(): number { return this.milliseconds / 3_600_000 }
  toDays(): number { return this.milliseconds / 86_400_000 }
  toWeeks(): number { return this.milliseconds / 604_800_000 }

  /** Get an object with each unit broken down */
  toComponents(): {
    days: number
    hours: number
    minutes: number
    seconds: number
    milliseconds: number
  } {
    let remaining = this.milliseconds
    const days = Math.floor(remaining / 86_400_000)
    remaining -= days * 86_400_000
    const hours = Math.floor(remaining / 3_600_000)
    remaining -= hours * 3_600_000
    const minutes = Math.floor(remaining / 60_000)
    remaining -= minutes * 60_000
    const seconds = Math.floor(remaining / 1000)
    const milliseconds = remaining - seconds * 1000

    return { days, hours, minutes, seconds, milliseconds }
  }

  /** Human-readable string like '2 hours, 30 minutes' */
  toHuman(): string {
    const { days, hours, minutes, seconds, milliseconds } = this.toComponents()
    const parts: string[] = []

    if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`)
    if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`)
    if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`)
    if (seconds > 0) parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`)
    if (milliseconds > 0 && parts.length === 0) parts.push(`${milliseconds}ms`)

    return parts.length > 0 ? parts.join(', ') : '0ms'
  }

  /** Compact string like '2h30m' */
  toCompact(): string {
    const { days, hours, minutes, seconds, milliseconds } = this.toComponents()
    const parts: string[] = []

    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    if (seconds > 0) parts.push(`${seconds}s`)
    if (milliseconds > 0 && parts.length === 0) parts.push(`${milliseconds}ms`)

    return parts.join('') || '0ms'
  }

  /** ISO 8601 duration string (e.g. PT2H30M) */
  toISO(): string {
    const { days, hours, minutes, seconds } = this.toComponents()
    let iso = 'P'
    if (days > 0) iso += `${days}D`
    if (hours > 0 || minutes > 0 || seconds > 0) {
      iso += 'T'
      if (hours > 0) iso += `${hours}H`
      if (minutes > 0) iso += `${minutes}M`
      if (seconds > 0) iso += `${seconds}S`
    }
    return iso === 'P' ? 'PT0S' : iso
  }

  // ── Comparisons ─────────────────────────────────────────────────

  isZero(): boolean { return this.milliseconds === 0 }
  isPositive(): boolean { return this.milliseconds > 0 }

  greaterThan(other: Duration): boolean { return this.milliseconds > other.milliseconds }
  lessThan(other: Duration): boolean { return this.milliseconds < other.milliseconds }
  equals(other: Duration): boolean { return this.milliseconds === other.milliseconds }

  // ── Date arithmetic ─────────────────────────────────────────────

  /** Add this duration to a date */
  addTo(date: Date): Date {
    return new Date(date.getTime() + this.milliseconds)
  }

  /** Subtract this duration from a date */
  subtractFrom(date: Date): Date {
    return new Date(date.getTime() - this.milliseconds)
  }

  /** Get a date that is this duration from now */
  fromNow(): Date {
    return this.addTo(new Date())
  }

  /** Get a date that was this duration ago */
  ago(): Date {
    return this.subtractFrom(new Date())
  }
}
