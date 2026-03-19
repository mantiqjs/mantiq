import type { Hasher } from '../contracts/Hasher.ts'

export interface BcryptOptions {
  rounds: number
}

const DEFAULT_ROUNDS = 10

/**
 * Bcrypt hasher using Bun.password (zero external deps).
 */
export class BcryptHasher implements Hasher {
  private readonly rounds: number

  constructor(options?: Partial<BcryptOptions>) {
    this.rounds = options?.rounds ?? DEFAULT_ROUNDS
  }

  async make(value: string): Promise<string> {
    return Bun.password.hash(value, {
      algorithm: 'bcrypt',
      cost: this.rounds,
    })
  }

  async check(value: string, hashedValue: string): Promise<boolean> {
    return Bun.password.verify(value, hashedValue, 'bcrypt')
  }

  needsRehash(hashedValue: string): boolean {
    // Bcrypt format: $2b$<cost>$...
    const match = hashedValue.match(/^\$2[aby]\$(\d+)\$/)
    if (!match) return true
    return parseInt(match[1]!, 10) !== this.rounds
  }
}
