/**
 * String utility functions and a fluent Stringable wrapper.
 *
 * @example
 * ```ts
 * Str.camel('foo_bar')          // 'fooBar'
 * Str.slug('Hello World!')      // 'hello-world'
 * Str.of('hello').upper().slug().toString() // 'HELLO'
 * ```
 */

// ── Static helpers ────────────────────────────────────────────────

export const Str = {
  /** Convert to camelCase */
  camel(value: string): string {
    return value
      .replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase())
      .replace(/^(.)/, (_, c) => c.toLowerCase())
  },

  /** Convert to snake_case */
  snake(value: string): string {
    return value
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase()
  },

  /** Convert to kebab-case */
  kebab(value: string): string {
    return value
      .replace(/([a-z\d])([A-Z])/g, '$1-$2')
      .replace(/[_\s]+/g, '-')
      .toLowerCase()
  },

  /** Convert to PascalCase */
  pascal(value: string): string {
    return value
      .replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase())
      .replace(/^(.)/, (_, c) => c.toUpperCase())
  },

  /** Convert to Title Case */
  title(value: string): string {
    return value
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  },

  /** Convert to Headline (Title Case with spaces before capitals) */
  headline(value: string): string {
    return Str.title(Str.snake(value).replace(/_/g, ' '))
  },

  /** Generate a URL-friendly slug */
  slug(value: string, separator = '-'): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s-]+/g, separator)
  },

  /** Simple English pluralization */
  plural(value: string): string {
    if (value.endsWith('y') && !/[aeiou]y$/i.test(value)) {
      return value.slice(0, -1) + 'ies'
    }
    if (/(?:s|sh|ch|x|z)$/i.test(value)) return value + 'es'
    if (value.endsWith('f')) return value.slice(0, -1) + 'ves'
    if (value.endsWith('fe')) return value.slice(0, -2) + 'ves'
    return value + 's'
  },

  /** Simple English singularization */
  singular(value: string): string {
    if (value.endsWith('ies')) return value.slice(0, -3) + 'y'
    if (value.endsWith('ves')) return value.slice(0, -3) + 'f'
    if (value.endsWith('ses') || value.endsWith('shes') || value.endsWith('ches') || value.endsWith('xes') || value.endsWith('zes')) {
      return value.slice(0, -2)
    }
    if (value.endsWith('s') && !value.endsWith('ss')) return value.slice(0, -1)
    return value
  },

  /** Generate a random alphanumeric string */
  random(length = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const bytes = crypto.getRandomValues(new Uint8Array(length))
    return Array.from(bytes, (b) => chars[b % chars.length]).join('')
  },

  /** Generate a UUID v4 */
  uuid(): string {
    return crypto.randomUUID()
  },

  /** Generate a ULID (Universally Unique Lexicographically Sortable Identifier) */
  ulid(): string {
    const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
    let now = Date.now()
    let time = ''
    for (let i = 0; i < 10; i++) {
      time = ENCODING[now % 32]! + time
      now = Math.floor(now / 32)
    }
    let random = ''
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    for (let i = 0; i < 16; i++) {
      random += ENCODING[bytes[i]! % 32]
    }
    return time + random
  },

  /** Mask a string, showing only the last N characters */
  mask(value: string, character = '*', index = 0, length?: number): string {
    const len = length ?? value.length - index
    const start = value.slice(0, index)
    const masked = character.repeat(Math.max(0, len))
    const end = value.slice(index + len)
    return start + masked + end
  },

  /** Truncate a string to a given length with an ellipsis */
  truncate(value: string, length: number, end = '...'): string {
    if (value.length <= length) return value
    return value.slice(0, length - end.length) + end
  },

  /** Truncate at the nearest word boundary */
  words(value: string, count: number, end = '...'): string {
    const w = value.split(/\s+/)
    if (w.length <= count) return value
    return w.slice(0, count).join(' ') + end
  },

  /** Check if the string contains a substring */
  contains(haystack: string, needle: string | string[]): boolean {
    const needles = Array.isArray(needle) ? needle : [needle]
    return needles.some((n) => haystack.includes(n))
  },

  /** Check if string starts with any of the given values */
  startsWith(value: string, prefix: string | string[]): boolean {
    const prefixes = Array.isArray(prefix) ? prefix : [prefix]
    return prefixes.some((p) => value.startsWith(p))
  },

  /** Check if string ends with any of the given values */
  endsWith(value: string, suffix: string | string[]): boolean {
    const suffixes = Array.isArray(suffix) ? suffix : [suffix]
    return suffixes.some((s) => value.endsWith(s))
  },

  /** Get the portion before the first occurrence of a delimiter */
  before(value: string, search: string): string {
    const idx = value.indexOf(search)
    return idx === -1 ? value : value.slice(0, idx)
  },

  /** Get the portion before the last occurrence of a delimiter */
  beforeLast(value: string, search: string): string {
    const idx = value.lastIndexOf(search)
    return idx === -1 ? value : value.slice(0, idx)
  },

  /** Get the portion after the first occurrence of a delimiter */
  after(value: string, search: string): string {
    const idx = value.indexOf(search)
    return idx === -1 ? value : value.slice(idx + search.length)
  },

  /** Get the portion after the last occurrence of a delimiter */
  afterLast(value: string, search: string): string {
    const idx = value.lastIndexOf(search)
    return idx === -1 ? value : value.slice(idx + search.length)
  },

  /** Get the portion between two delimiters */
  between(value: string, start: string, end: string): string {
    return Str.before(Str.after(value, start), end)
  },

  /** Check if string matches a wildcard pattern (* for any) */
  is(pattern: string, value: string): boolean {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
    )
    return regex.test(value)
  },

  /** Extract an excerpt around a phrase */
  excerpt(text: string, phrase: string, options?: { radius?: number; omission?: string }): string {
    const radius = options?.radius ?? 100
    const omission = options?.omission ?? '...'
    const idx = text.toLowerCase().indexOf(phrase.toLowerCase())
    if (idx === -1) return Str.truncate(text, radius * 2 + phrase.length, omission)

    const start = Math.max(0, idx - radius)
    const end = Math.min(text.length, idx + phrase.length + radius)
    let result = text.slice(start, end)
    if (start > 0) result = omission + result
    if (end < text.length) result = result + omission
    return result
  },

  /** Generate a secure random password */
  password(length = 32): string {
    const lower = 'abcdefghijklmnopqrstuvwxyz'
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const digits = '0123456789'
    const symbols = '!@#$%^&*()-_=+[]{}|;:,.<>?'
    const all = lower + upper + digits + symbols
    const bytes = crypto.getRandomValues(new Uint8Array(length))
    // Ensure at least one of each category
    const required = [
      lower[bytes[0]! % lower.length]!,
      upper[bytes[1]! % upper.length]!,
      digits[bytes[2]! % digits.length]!,
      symbols[bytes[3]! % symbols.length]!,
    ]
    const rest = Array.from(bytes.slice(4, length), (b) => all[b % all.length])
    const chars = [...required, ...rest]
    // Shuffle
    for (let i = chars.length - 1; i > 0; i--) {
      const j = bytes[i % bytes.length]! % (i + 1)
      ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
    }
    return chars.join('')
  },

  /** Pad both sides of a string to a given length */
  padBoth(value: string, length: number, pad = ' '): string {
    const diff = length - value.length
    if (diff <= 0) return value
    const left = Math.floor(diff / 2)
    const right = diff - left
    return pad.repeat(left) + value + pad.repeat(right)
  },

  /** Repeat a string N times */
  repeat(value: string, times: number): string {
    return value.repeat(times)
  },

  /** Replace the first occurrence */
  replaceFirst(value: string, search: string, replace: string): string {
    const idx = value.indexOf(search)
    if (idx === -1) return value
    return value.slice(0, idx) + replace + value.slice(idx + search.length)
  },

  /** Replace the last occurrence */
  replaceLast(value: string, search: string, replace: string): string {
    const idx = value.lastIndexOf(search)
    if (idx === -1) return value
    return value.slice(0, idx) + replace + value.slice(idx + search.length)
  },

  /** Reverse a string (Unicode-safe) */
  reverse(value: string): string {
    return [...value].reverse().join('')
  },

  /** Count words in a string */
  wordCount(value: string): number {
    return value.trim().split(/\s+/).filter(Boolean).length
  },

  /** Wrap a string with a given string */
  wrap(value: string, before: string, after?: string): string {
    return before + value + (after ?? before)
  },

  /** Unwrap a string (remove wrapping characters) */
  unwrap(value: string, before: string, after?: string): string {
    const a = after ?? before
    let result = value
    if (result.startsWith(before)) result = result.slice(before.length)
    if (result.endsWith(a)) result = result.slice(0, -a.length)
    return result
  },

  /** Ensure a string starts with a given prefix */
  start(value: string, prefix: string): string {
    return value.startsWith(prefix) ? value : prefix + value
  },

  /** Ensure a string ends with a given suffix */
  finish(value: string, suffix: string): string {
    return value.endsWith(suffix) ? value : value + suffix
  },

  /** Check if a string is a valid UUID */
  isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  },

  /** Check if a string is a valid ULID */
  isUlid(value: string): boolean {
    return /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(value)
  },

  /** Create a fluent Stringable wrapper */
  of(value: string): Stringable {
    return new Stringable(value)
  },
}

// ── Fluent Stringable wrapper ─────────────────────────────────────

/**
 * Fluent string manipulation — chain operations without temp variables.
 *
 * @example
 * ```ts
 * Str.of('hello world')
 *   .title()
 *   .slug()
 *   .toString()  // 'hello-world'
 * ```
 */
export class Stringable {
  constructor(private value: string) {}

  toString(): string { return this.value }
  valueOf(): string { return this.value }
  get length(): number { return this.value.length }

  // ── Transforms (return new Stringable) ──────────────────────────

  upper(): Stringable { return new Stringable(this.value.toUpperCase()) }
  lower(): Stringable { return new Stringable(this.value.toLowerCase()) }
  trim(): Stringable { return new Stringable(this.value.trim()) }
  ltrim(chars?: string): Stringable {
    if (!chars) return new Stringable(this.value.trimStart())
    const regex = new RegExp(`^[${chars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]+`)
    return new Stringable(this.value.replace(regex, ''))
  }
  rtrim(chars?: string): Stringable {
    if (!chars) return new Stringable(this.value.trimEnd())
    const regex = new RegExp(`[${chars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]+$`)
    return new Stringable(this.value.replace(regex, ''))
  }

  camel(): Stringable { return new Stringable(Str.camel(this.value)) }
  snake(): Stringable { return new Stringable(Str.snake(this.value)) }
  kebab(): Stringable { return new Stringable(Str.kebab(this.value)) }
  pascal(): Stringable { return new Stringable(Str.pascal(this.value)) }
  title(): Stringable { return new Stringable(Str.title(this.value)) }
  headline(): Stringable { return new Stringable(Str.headline(this.value)) }
  slug(separator = '-'): Stringable { return new Stringable(Str.slug(this.value, separator)) }
  plural(): Stringable { return new Stringable(Str.plural(this.value)) }
  singular(): Stringable { return new Stringable(Str.singular(this.value)) }

  mask(character = '*', index = 0, length?: number): Stringable {
    return new Stringable(Str.mask(this.value, character, index, length))
  }
  truncate(length: number, end?: string): Stringable {
    return new Stringable(Str.truncate(this.value, length, end))
  }
  words(count: number, end?: string): Stringable {
    return new Stringable(Str.words(this.value, count, end))
  }
  padBoth(length: number, pad?: string): Stringable {
    return new Stringable(Str.padBoth(this.value, length, pad))
  }
  padLeft(length: number, pad = ' '): Stringable {
    return new Stringable(this.value.padStart(length, pad))
  }
  padRight(length: number, pad = ' '): Stringable {
    return new Stringable(this.value.padEnd(length, pad))
  }
  repeat(times: number): Stringable { return new Stringable(this.value.repeat(times)) }
  reverse(): Stringable { return new Stringable(Str.reverse(this.value)) }
  replace(search: string | RegExp, replacement: string): Stringable {
    return new Stringable(this.value.replace(search, replacement))
  }
  replaceAll(search: string, replacement: string): Stringable {
    return new Stringable(this.value.replaceAll(search, replacement))
  }
  replaceFirst(search: string, replacement: string): Stringable {
    return new Stringable(Str.replaceFirst(this.value, search, replacement))
  }
  replaceLast(search: string, replacement: string): Stringable {
    return new Stringable(Str.replaceLast(this.value, search, replacement))
  }
  append(suffix: string): Stringable { return new Stringable(this.value + suffix) }
  prepend(prefix: string): Stringable { return new Stringable(prefix + this.value) }
  wrap(before: string, after?: string): Stringable {
    return new Stringable(Str.wrap(this.value, before, after))
  }
  unwrap(before: string, after?: string): Stringable {
    return new Stringable(Str.unwrap(this.value, before, after))
  }
  start(prefix: string): Stringable { return new Stringable(Str.start(this.value, prefix)) }
  finish(suffix: string): Stringable { return new Stringable(Str.finish(this.value, suffix)) }
  substr(start: number, length?: number): Stringable {
    return new Stringable(length !== undefined ? this.value.slice(start, start + length) : this.value.slice(start))
  }

  before(search: string): Stringable { return new Stringable(Str.before(this.value, search)) }
  beforeLast(search: string): Stringable { return new Stringable(Str.beforeLast(this.value, search)) }
  after(search: string): Stringable { return new Stringable(Str.after(this.value, search)) }
  afterLast(search: string): Stringable { return new Stringable(Str.afterLast(this.value, search)) }
  between(start: string, end: string): Stringable { return new Stringable(Str.between(this.value, start, end)) }

  // ── Conditionals ────────────────────────────────────────────────

  /** Apply a callback only when condition is true */
  when(condition: boolean, callback: (s: Stringable) => Stringable): Stringable {
    return condition ? callback(this) : this
  }

  /** Apply a callback unless condition is true */
  unless(condition: boolean, callback: (s: Stringable) => Stringable): Stringable {
    return condition ? this : callback(this)
  }

  /** Pipe through a custom function */
  pipe(callback: (value: string) => string): Stringable {
    return new Stringable(callback(this.value))
  }

  /** Inspect the value (pass through, for debugging) */
  tap(callback: (value: string) => void): Stringable {
    callback(this.value)
    return this
  }

  // ── Predicates ──────────────────────────────────────────────────

  contains(needle: string | string[]): boolean { return Str.contains(this.value, needle) }
  startsWith(prefix: string | string[]): boolean { return Str.startsWith(this.value, prefix) }
  endsWith(suffix: string | string[]): boolean { return Str.endsWith(this.value, suffix) }
  is(pattern: string): boolean { return Str.is(pattern, this.value) }
  isEmpty(): boolean { return this.value.length === 0 }
  isNotEmpty(): boolean { return this.value.length > 0 }
  isUuid(): boolean { return Str.isUuid(this.value) }
  isUlid(): boolean { return Str.isUlid(this.value) }

  // ── Extraction ──────────────────────────────────────────────────

  wordCount(): number { return Str.wordCount(this.value) }
  split(separator: string | RegExp, limit?: number): string[] { return this.value.split(separator, limit) }
  match(pattern: RegExp): RegExpMatchArray | null { return this.value.match(pattern) }
  matchAll(pattern: RegExp): string[] {
    return [...this.value.matchAll(pattern)].map((m) => m[0])
  }
  excerpt(phrase: string, options?: { radius?: number; omission?: string }): Stringable {
    return new Stringable(Str.excerpt(this.value, phrase, options))
  }
}
