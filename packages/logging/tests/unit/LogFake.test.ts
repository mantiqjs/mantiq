import { describe, it, expect } from 'bun:test'
import { LogFake } from '../../src/testing/LogFake.ts'

describe('LogFake', () => {
  it('records log messages', () => {
    const fake = new LogFake()
    fake.info('hello')
    fake.error('oops', { code: 42 })

    const all = fake.all()
    expect(all).toHaveLength(2)
    expect(all[0]!.level).toBe('info')
    expect(all[0]!.message).toBe('hello')
    expect(all[1]!.level).toBe('error')
    expect(all[1]!.context).toEqual({ code: 42 })
  })

  describe('assertLogged', () => {
    it('passes when matching message exists', () => {
      const fake = new LogFake()
      fake.info('test message')
      expect(() => fake.assertLogged('info', 'test message')).not.toThrow()
    })

    it('fails when no matching message', () => {
      const fake = new LogFake()
      fake.info('other')
      expect(() => fake.assertLogged('error', 'missing')).toThrow(/Expected log/)
    })

    it('matches by level only', () => {
      const fake = new LogFake()
      fake.warning('anything')
      expect(() => fake.assertLogged('warning')).not.toThrow()
    })

    it('matches by regex', () => {
      const fake = new LogFake()
      fake.info('User 42 logged in')
      expect(() => fake.assertLogged('info', /User \d+ logged in/)).not.toThrow()
    })

    it('asserts exact count', () => {
      const fake = new LogFake()
      fake.info('a')
      fake.info('b')
      fake.info('c')
      expect(() => fake.assertLogged('info', undefined, 3)).not.toThrow()
      expect(() => fake.assertLogged('info', undefined, 2)).toThrow(/Expected 2/)
    })
  })

  describe('assertNotLogged', () => {
    it('passes when no matching message', () => {
      const fake = new LogFake()
      fake.info('hello')
      expect(() => fake.assertNotLogged('error')).not.toThrow()
    })

    it('fails when matching message exists', () => {
      const fake = new LogFake()
      fake.error('oops')
      expect(() => fake.assertNotLogged('error', 'oops')).toThrow(/Unexpected log/)
    })
  })

  describe('assertNothingLogged', () => {
    it('passes when empty', () => {
      const fake = new LogFake()
      expect(() => fake.assertNothingLogged()).not.toThrow()
    })

    it('fails when logs exist', () => {
      const fake = new LogFake()
      fake.debug('trace')
      expect(() => fake.assertNothingLogged()).toThrow(/Expected no logs/)
    })
  })

  describe('assertLoggedCount', () => {
    it('passes with correct count', () => {
      const fake = new LogFake()
      fake.info('a')
      fake.error('b')
      expect(() => fake.assertLoggedCount(2)).not.toThrow()
    })

    it('fails with wrong count', () => {
      const fake = new LogFake()
      fake.info('a')
      expect(() => fake.assertLoggedCount(5)).toThrow(/Expected 5/)
    })
  })

  describe('forLevel', () => {
    it('filters by level', () => {
      const fake = new LogFake()
      fake.info('a')
      fake.error('b')
      fake.info('c')
      fake.debug('d')

      expect(fake.forLevel('info')).toHaveLength(2)
      expect(fake.forLevel('error')).toHaveLength(1)
      expect(fake.forLevel('debug')).toHaveLength(1)
      expect(fake.forLevel('warning')).toHaveLength(0)
    })
  })

  describe('hasLogged', () => {
    it('returns true when matching', () => {
      const fake = new LogFake()
      fake.info('found')
      expect(fake.hasLogged('info', 'found')).toBe(true)
      expect(fake.hasLogged('info', 'missing')).toBe(false)
      expect(fake.hasLogged('error')).toBe(false)
    })
  })

  describe('reset', () => {
    it('clears all recorded logs', () => {
      const fake = new LogFake()
      fake.info('a')
      fake.error('b')
      fake.reset()
      expect(fake.all()).toHaveLength(0)
      expect(() => fake.assertNothingLogged()).not.toThrow()
    })
  })
})
