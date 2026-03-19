import type { SessionHandler } from '../contracts/Session.ts'

/**
 * Session store — holds key/value data for one session.
 * Reads from and writes to a SessionHandler (driver).
 */
export class SessionStore {
  private id: string
  private attributes: Record<string, unknown> = {}
  private started = false

  constructor(
    private readonly name: string,
    private readonly handler: SessionHandler,
    id?: string,
  ) {
    this.id = id ?? SessionStore.generateId()
  }

  /**
   * Start the session — loads data from the handler.
   */
  async start(): Promise<boolean> {
    const data = await this.handler.read(this.id)

    if (data) {
      try {
        this.attributes = JSON.parse(data)
      } catch {
        this.attributes = {}
      }
    }

    this.started = true
    return true
  }

  /**
   * Save the session — writes data to the handler.
   */
  async save(): Promise<void> {
    await this.handler.write(this.id, JSON.stringify(this.attributes))
    this.started = false
  }

  // ── Getters & setters ───────────────────────────────────────────────────

  get<T = unknown>(key: string, defaultValue?: T): T {
    return (this.attributes[key] as T) ?? (defaultValue as T)
  }

  put(key: string, value: unknown): void {
    this.attributes[key] = value
  }

  has(key: string): boolean {
    return key in this.attributes
  }

  forget(key: string): void {
    delete this.attributes[key]
  }

  pull<T = unknown>(key: string, defaultValue?: T): T {
    const value = this.get<T>(key, defaultValue)
    this.forget(key)
    return value
  }

  all(): Record<string, unknown> {
    return { ...this.attributes }
  }

  replace(attributes: Record<string, unknown>): void {
    this.attributes = { ...this.attributes, ...attributes }
  }

  flush(): void {
    this.attributes = {}
  }

  // ── Flash data ──────────────────────────────────────────────────────────

  flash(key: string, value: unknown): void {
    this.put(key, value)
    const newFlash = this.get<string[]>('_flash.new', [])
    if (!newFlash.includes(key)) newFlash.push(key)
    this.put('_flash.new', newFlash)
  }

  reflash(): void {
    const old = this.get<string[]>('_flash.old', [])
    const newFlash = this.get<string[]>('_flash.new', [])
    this.put('_flash.new', [...new Set([...newFlash, ...old])])
    this.put('_flash.old', [])
  }

  keep(...keys: string[]): void {
    const old = this.get<string[]>('_flash.old', [])
    const newFlash = this.get<string[]>('_flash.new', [])
    const toKeep = keys.length > 0 ? keys : old
    this.put('_flash.new', [...new Set([...newFlash, ...toKeep])])
    this.put('_flash.old', old.filter((k) => !toKeep.includes(k)))
  }

  /**
   * Age the flash data — called at the end of each request.
   * Moves "new" flash keys to "old", and removes previously old keys.
   */
  ageFlashData(): void {
    const old = this.get<string[]>('_flash.old', [])
    for (const key of old) {
      this.forget(key)
    }
    this.put('_flash.old', this.get<string[]>('_flash.new', []))
    this.put('_flash.new', [])
  }

  // ── CSRF Token ──────────────────────────────────────────────────────────

  token(): string {
    if (!this.has('_token')) {
      this.regenerateToken()
    }
    return this.get<string>('_token')!
  }

  regenerateToken(): void {
    const bytes = new Uint8Array(40)
    crypto.getRandomValues(bytes)
    let token = ''
    for (let i = 0; i < bytes.length; i++) {
      token += bytes[i]!.toString(16).padStart(2, '0')
    }
    this.put('_token', token)
  }

  // ── Session ID management ──────────────────────────────────────────────

  getId(): string {
    return this.id
  }

  setId(id: string): void {
    this.id = id
  }

  getName(): string {
    return this.name
  }

  isStarted(): boolean {
    return this.started
  }

  /**
   * Regenerate the session ID (e.g. after login to prevent fixation).
   */
  async regenerate(destroy = false): Promise<void> {
    if (destroy) {
      await this.handler.destroy(this.id)
    }
    this.id = SessionStore.generateId()
  }

  /**
   * Invalidate + regenerate: flush all data AND get a new ID.
   */
  async invalidate(): Promise<void> {
    this.flush()
    await this.regenerate(true)
  }

  /**
   * Return the serialized session data (for cookie driver).
   */
  serialize(): string {
    return JSON.stringify(this.attributes)
  }

  // ── Static helpers ──────────────────────────────────────────────────────

  static generateId(): string {
    const bytes = new Uint8Array(20)
    crypto.getRandomValues(bytes)
    let id = ''
    for (let i = 0; i < bytes.length; i++) {
      id += bytes[i]!.toString(16).padStart(2, '0')
    }
    return id
  }
}
