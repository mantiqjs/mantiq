import type { Hasher } from '../contracts/Hasher.ts'
import type { DriverManager } from '../contracts/DriverManager.ts'
import { BcryptHasher } from './BcryptHasher.ts'
import { Argon2Hasher } from './Argon2Hasher.ts'

export interface HashConfig {
  driver: string
  bcrypt?: { rounds?: number }
  argon2?: { memoryCost?: number; timeCost?: number }
}

/**
 * Multi-driver hash manager (Laravel-style).
 *
 * Supports bcrypt and argon2id out of the box.
 * Custom drivers can be added via `extend()`.
 */
export class HashManager implements DriverManager<Hasher>, Hasher {
  private readonly config: HashConfig
  private readonly drivers = new Map<string, Hasher>()
  private readonly customCreators = new Map<string, () => Hasher>()

  constructor(config?: Partial<HashConfig>) {
    this.config = {
      driver: config?.driver ?? 'bcrypt',
      bcrypt: config?.bcrypt ?? {},
      argon2: config?.argon2 ?? {},
    }
  }

  // ── DriverManager ───────────────────────────────────────────────────────

  driver(name?: string): Hasher {
    const driverName = name ?? this.getDefaultDriver()

    if (!this.drivers.has(driverName)) {
      this.drivers.set(driverName, this.createDriver(driverName))
    }

    return this.drivers.get(driverName)!
  }

  extend(name: string, factory: () => Hasher): void {
    this.customCreators.set(name, factory)
  }

  getDefaultDriver(): string {
    return this.config.driver
  }

  // ── Hasher (delegates to default driver) ────────────────────────────────

  async make(value: string): Promise<string> {
    return this.driver().make(value)
  }

  async check(value: string, hashedValue: string): Promise<boolean> {
    return this.driver().check(value, hashedValue)
  }

  needsRehash(hashedValue: string): boolean {
    return this.driver().needsRehash(hashedValue)
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private createDriver(name: string): Hasher {
    const custom = this.customCreators.get(name)
    if (custom) return custom()

    switch (name) {
      case 'bcrypt':
        return new BcryptHasher(this.config.bcrypt)
      case 'argon2':
        return new Argon2Hasher(this.config.argon2)
      default:
        throw new Error(`Unsupported hash driver: ${name}. Use extend() to register custom drivers.`)
    }
  }
}
