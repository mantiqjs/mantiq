import type { Hasher } from '../contracts/Hasher.ts'

export interface Argon2Options {
  memoryCost: number
  timeCost: number
}

const DEFAULTS: Argon2Options = {
  memoryCost: 65536, // 64 MB
  timeCost: 4,
}

/**
 * Argon2id hasher using Bun.password (zero external deps).
 */
export class Argon2Hasher implements Hasher {
  private readonly memoryCost: number
  private readonly timeCost: number

  constructor(options?: Partial<Argon2Options>) {
    this.memoryCost = options?.memoryCost ?? DEFAULTS.memoryCost
    this.timeCost = options?.timeCost ?? DEFAULTS.timeCost
  }

  async make(value: string): Promise<string> {
    return Bun.password.hash(value, {
      algorithm: 'argon2id',
      memoryCost: this.memoryCost,
      timeCost: this.timeCost,
    })
  }

  async check(value: string, hashedValue: string): Promise<boolean> {
    return Bun.password.verify(value, hashedValue, 'argon2id')
  }

  needsRehash(hashedValue: string): boolean {
    // Argon2 format: $argon2id$v=19$m=<mem>,t=<time>,p=<par>$...
    const match = hashedValue.match(/\$argon2id\$v=\d+\$m=(\d+),t=(\d+),/)
    if (!match) return true
    return (
      parseInt(match[1]!, 10) !== this.memoryCost ||
      parseInt(match[2]!, 10) !== this.timeCost
    )
  }
}
