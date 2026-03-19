import { describe, it, expect } from 'bun:test'
import { HashManager } from '../../src/hashing/HashManager.ts'
import { BcryptHasher } from '../../src/hashing/BcryptHasher.ts'
import { Argon2Hasher } from '../../src/hashing/Argon2Hasher.ts'

describe('BcryptHasher', () => {
  const hasher = new BcryptHasher({ rounds: 4 }) // Low rounds for test speed

  it('hashes and verifies a password', async () => {
    const hash = await hasher.make('password123')
    expect(hash).not.toBe('password123')
    expect(hash.startsWith('$2')).toBe(true)
    expect(await hasher.check('password123', hash)).toBe(true)
  })

  it('rejects wrong password', async () => {
    const hash = await hasher.make('correct')
    expect(await hasher.check('wrong', hash)).toBe(false)
  })

  it('detects when rehash is needed (cost changed)', async () => {
    const hash = await hasher.make('test')
    expect(hasher.needsRehash(hash)).toBe(false)

    const otherHasher = new BcryptHasher({ rounds: 12 })
    expect(otherHasher.needsRehash(hash)).toBe(true)
  })
})

describe('Argon2Hasher', () => {
  const hasher = new Argon2Hasher({ memoryCost: 1024, timeCost: 1 }) // Low cost for test speed

  it('hashes and verifies a password', async () => {
    const hash = await hasher.make('password123')
    expect(hash).not.toBe('password123')
    expect(hash.startsWith('$argon2id$')).toBe(true)
    expect(await hasher.check('password123', hash)).toBe(true)
  })

  it('rejects wrong password', async () => {
    const hash = await hasher.make('correct')
    expect(await hasher.check('wrong', hash)).toBe(false)
  })

  it('detects when rehash is needed (cost changed)', async () => {
    const hash = await hasher.make('test')
    expect(hasher.needsRehash(hash)).toBe(false)

    const otherHasher = new Argon2Hasher({ memoryCost: 2048, timeCost: 2 })
    expect(otherHasher.needsRehash(hash)).toBe(true)
  })
})

describe('HashManager', () => {
  it('defaults to bcrypt', () => {
    const manager = new HashManager()
    expect(manager.getDefaultDriver()).toBe('bcrypt')
  })

  it('hashes with default driver', async () => {
    const manager = new HashManager({ bcrypt: { rounds: 4 } })
    const hash = await manager.make('test')
    expect(hash.startsWith('$2')).toBe(true)
    expect(await manager.check('test', hash)).toBe(true)
  })

  it('switches to argon2 driver', async () => {
    const manager = new HashManager({ driver: 'argon2', argon2: { memoryCost: 1024, timeCost: 1 } })
    const hash = await manager.make('test')
    expect(hash.startsWith('$argon2id$')).toBe(true)
    expect(await manager.check('test', hash)).toBe(true)
  })

  it('supports custom drivers via extend', async () => {
    const manager = new HashManager()
    manager.extend('custom', () => new BcryptHasher({ rounds: 4 }))
    const hash = await manager.driver('custom').make('test')
    expect(await manager.driver('custom').check('test', hash)).toBe(true)
  })

  it('throws for unknown driver', () => {
    const manager = new HashManager({ driver: 'nope' })
    expect(() => manager.driver()).toThrow('Unsupported hash driver: nope')
  })
})
