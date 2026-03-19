/**
 * Lightweight fake data generator — zero dependencies.
 *
 * Covers the most common needs for seeding and testing without pulling in
 * a heavyweight library like faker-js. Every method is deterministic when
 * seeded, or random by default.
 *
 * @example
 * const fake = new Faker()
 * fake.name()        // "Liam Chen"
 * fake.email()       // "olivia.martinez42@example.com"
 * fake.sentence()    // "The quick brown fox jumps over the lazy dog."
 */
export class Faker {
  private seed: number | null = null
  private state: number = 0

  constructor(seed?: number) {
    if (seed !== undefined) {
      this.seed = seed
      this.state = seed
    }
  }

  // ── Random primitives ──────────────────────────────────────────────────────

  /** Random float in [0, 1) — seeded or Math.random() */
  random(): number {
    if (this.seed === null) return Math.random()
    // xorshift32
    this.state ^= this.state << 13
    this.state ^= this.state >> 17
    this.state ^= this.state << 5
    return (this.state >>> 0) / 4294967296
  }

  /** Random integer in [min, max] inclusive */
  int(min = 0, max = 100): number {
    return Math.floor(this.random() * (max - min + 1)) + min
  }

  /** Random float in [min, max) */
  float(min = 0, max = 1, decimals = 2): number {
    const val = this.random() * (max - min) + min
    const factor = 10 ** decimals
    return Math.round(val * factor) / factor
  }

  /** Random boolean with optional probability of true */
  boolean(truthiness = 0.5): boolean {
    return this.random() < truthiness
  }

  /** Pick a random element from an array */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)]!
  }

  /** Pick n unique elements from an array */
  pickMultiple<T>(arr: readonly T[], count: number): T[] {
    const shuffled = [...arr].sort(() => this.random() - 0.5)
    return shuffled.slice(0, Math.min(count, arr.length))
  }

  /** Shuffle an array (returns new array) */
  shuffle<T>(arr: readonly T[]): T[] {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.int(0, i)
      ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
    }
    return copy
  }

  // ── Person ─────────────────────────────────────────────────────────────────

  firstName(): string {
    return this.pick(FIRST_NAMES)
  }

  lastName(): string {
    return this.pick(LAST_NAMES)
  }

  name(): string {
    return `${this.firstName()} ${this.lastName()}`
  }

  /** Random username: first.last + optional digits */
  username(): string {
    const first = this.firstName().toLowerCase()
    const last = this.lastName().toLowerCase()
    const suffix = this.boolean(0.6) ? String(this.int(1, 99)) : ''
    return `${first}.${last}${suffix}`
  }

  // ── Internet ───────────────────────────────────────────────────────────────

  email(domain?: string): string {
    const d = domain ?? this.pick(EMAIL_DOMAINS)
    return `${this.username()}@${d}`
  }

  url(): string {
    return `https://${this.pick(DOMAINS)}/${this.slug()}`
  }

  ip(): string {
    return `${this.int(1, 255)}.${this.int(0, 255)}.${this.int(0, 255)}.${this.int(1, 254)}`
  }

  ipv6(): string {
    const segments: string[] = []
    for (let i = 0; i < 8; i++) segments.push(this.int(0, 0xffff).toString(16).padStart(4, '0'))
    return segments.join(':')
  }

  /** Random hex color */
  hexColor(): string {
    return '#' + this.int(0, 0xffffff).toString(16).padStart(6, '0')
  }

  userAgent(): string {
    return this.pick(USER_AGENTS)
  }

  // ── Text ───────────────────────────────────────────────────────────────────

  word(): string {
    return this.pick(WORDS)
  }

  words(count?: number): string {
    const n = count ?? this.int(2, 6)
    return Array.from({ length: n }, () => this.word()).join(' ')
  }

  sentence(wordCount?: number): string {
    const w = this.words(wordCount ?? this.int(5, 12))
    return w.charAt(0).toUpperCase() + w.slice(1) + '.'
  }

  sentences(count?: number): string {
    const n = count ?? this.int(2, 5)
    return Array.from({ length: n }, () => this.sentence()).join(' ')
  }

  paragraph(sentenceCount?: number): string {
    return this.sentences(sentenceCount ?? this.int(3, 6))
  }

  paragraphs(count?: number): string {
    const n = count ?? this.int(2, 4)
    return Array.from({ length: n }, () => this.paragraph()).join('\n\n')
  }

  slug(wordCount?: number): string {
    return this.words(wordCount ?? this.int(2, 4)).replace(/\s+/g, '-')
  }

  // ── Numbers & IDs ──────────────────────────────────────────────────────────

  uuid(): string {
    const hex = () => this.int(0, 0xffff).toString(16).padStart(4, '0')
    return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${this.pick(['8', '9', 'a', 'b'])}${hex().slice(1)}-${hex()}${hex()}${hex()}`
  }

  /** Numeric string of given length */
  numericId(length = 8): string {
    return Array.from({ length }, () => this.int(0, 9)).join('')
  }

  // ── Date & Time ────────────────────────────────────────────────────────────

  /** Random date between two dates */
  date(from?: Date, to?: Date): Date {
    const start = (from ?? new Date('2020-01-01')).getTime()
    const end = (to ?? new Date()).getTime()
    return new Date(this.int(start, end))
  }

  /** ISO date string */
  dateString(from?: Date, to?: Date): string {
    return this.date(from, to).toISOString()
  }

  /** Recent date (within last N days, default 7) */
  recent(days = 7): Date {
    const now = Date.now()
    return new Date(now - this.int(0, days * 86400000))
  }

  /** Future date (within next N days, default 30) */
  future(days = 30): Date {
    const now = Date.now()
    return new Date(now + this.int(1, days * 86400000))
  }

  // ── Address ────────────────────────────────────────────────────────────────

  city(): string {
    return this.pick(CITIES)
  }

  country(): string {
    return this.pick(COUNTRIES)
  }

  zipCode(): string {
    return this.numericId(5)
  }

  latitude(): number {
    return this.float(-90, 90, 6)
  }

  longitude(): number {
    return this.float(-180, 180, 6)
  }

  // ── Company ────────────────────────────────────────────────────────────────

  company(): string {
    return this.pick(COMPANIES)
  }

  jobTitle(): string {
    return `${this.pick(JOB_LEVELS)} ${this.pick(JOB_AREAS)} ${this.pick(JOB_TYPES)}`
  }

  // ── Phone ──────────────────────────────────────────────────────────────────

  phone(): string {
    return `+1${this.numericId(10)}`
  }

  // ── Image / Avatar ─────────────────────────────────────────────────────────

  /** Placeholder avatar URL */
  avatar(): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.name())}&size=128`
  }

  imageUrl(width = 640, height = 480): string {
    return `https://picsum.photos/seed/${this.int(1, 99999)}/${width}/${height}`
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Generate a value from a pattern: # = digit, ? = lowercase letter, * = alphanumeric */
  fromPattern(pattern: string): string {
    let result = ''
    for (const ch of pattern) {
      if (ch === '#') result += String(this.int(0, 9))
      else if (ch === '?') result += String.fromCharCode(this.int(97, 122))
      else if (ch === '*') result += this.pick('abcdefghijklmnopqrstuvwxyz0123456789'.split(''))
      else result += ch
    }
    return result
  }

  /** Random hex string */
  hex(length = 16): string {
    return Array.from({ length }, () => this.int(0, 15).toString(16)).join('')
  }

  /** Random alphanumeric string */
  alphanumeric(length = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    return Array.from({ length }, () => chars[this.int(0, chars.length - 1)]).join('')
  }

  /** Unique values: returns a proxy that deduplicates */
  unique<K extends keyof this>(method: K, maxRetries = 100): this[K] {
    const seen = new Set<any>()
    const original = (this as any)[method]
    if (typeof original !== 'function') throw new Error(`${String(method)} is not a method`)
    return ((...args: any[]) => {
      for (let i = 0; i < maxRetries; i++) {
        const val = original.call(this, ...args)
        if (!seen.has(val)) { seen.add(val); return val }
      }
      throw new Error(`Faker.unique: could not generate unique ${String(method)} after ${maxRetries} tries`)
    }) as any
  }
}

// ── Data pools ──────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Liam', 'Olivia', 'Noah', 'Emma', 'James', 'Sophia', 'Lucas', 'Ava',
  'Mason', 'Isabella', 'Ethan', 'Mia', 'Alexander', 'Charlotte', 'Henry',
  'Amelia', 'Sebastian', 'Harper', 'Jack', 'Evelyn', 'Daniel', 'Aria',
  'Owen', 'Chloe', 'Samuel', 'Ella', 'Ryan', 'Scarlett', 'Leo', 'Grace',
  'Nathan', 'Lily', 'Caleb', 'Layla', 'Isaac', 'Riley', 'Adam', 'Zoey',
  'Dylan', 'Nora', 'Aiden', 'Hannah', 'Elijah', 'Stella', 'Logan', 'Luna',
  'Gabriel', 'Penelope', 'Matthew', 'Violet',
] as const

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
  'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark',
  'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
  'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green',
  'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
  'Carter', 'Chen',
] as const

const EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'proton.me',
  'icloud.com', 'mail.com', 'example.com', 'test.com',
] as const

const DOMAINS = [
  'example.com', 'test.org', 'sample.net', 'demo.io', 'mysite.dev',
] as const

const WORDS = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her',
  'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there',
  'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get',
  'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no',
  'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your',
  'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then',
  'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first',
  'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these',
  'give', 'day', 'most', 'find', 'here', 'thing', 'many', 'right',
  'large', 'great', 'system', 'part', 'small', 'number', 'place',
  'point', 'home', 'hand', 'high', 'keep', 'last', 'long', 'world',
  'school', 'still', 'study', 'every', 'start', 'might', 'story',
  'city', 'open', 'build', 'group', 'local', 'state', 'power',
  'data', 'team', 'cloud', 'pixel', 'orbit', 'spark', 'pulse',
  'swift', 'bloom', 'forge', 'haven', 'ridge', 'ember', 'frost',
] as const

const CITIES = [
  'New York', 'London', 'Tokyo', 'Paris', 'Berlin', 'Sydney', 'Toronto',
  'Mumbai', 'São Paulo', 'Seoul', 'Dubai', 'Singapore', 'Amsterdam',
  'Stockholm', 'San Francisco', 'Chicago', 'Los Angeles', 'Barcelona',
  'Melbourne', 'Austin',
] as const

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany',
  'France', 'Japan', 'Brazil', 'India', 'South Korea', 'Netherlands',
  'Sweden', 'Singapore', 'Spain', 'Italy', 'Mexico', 'Argentina',
  'New Zealand', 'Switzerland', 'Portugal',
] as const

const COMPANIES = [
  'Acme Corp', 'Globex', 'Initech', 'Hooli', 'Pied Piper', 'Stark Industries',
  'Wayne Enterprises', 'Umbrella Corp', 'Soylent Corp', 'Tyrell Corp',
  'Cyberdyne Systems', 'Massive Dynamic', 'Wonka Industries', 'Dunder Mifflin',
  'Sterling Cooper', 'Weyland-Yutani', 'Aperture Science', 'Oscorp',
  'LexCorp', 'Prestige Worldwide',
] as const

const JOB_LEVELS = [
  'Senior', 'Junior', 'Lead', 'Principal', 'Staff', 'Associate', 'Chief',
] as const

const JOB_AREAS = [
  'Software', 'Product', 'Design', 'Marketing', 'Sales', 'Data',
  'DevOps', 'Security', 'Research', 'Operations',
] as const

const JOB_TYPES = [
  'Engineer', 'Manager', 'Analyst', 'Architect', 'Consultant', 'Director',
  'Specialist', 'Developer', 'Designer', 'Strategist',
] as const

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
] as const
