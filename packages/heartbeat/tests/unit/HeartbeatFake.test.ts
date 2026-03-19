import { describe, it, expect } from 'bun:test'
import { HeartbeatFake } from '../../src/testing/HeartbeatFake.ts'

describe('HeartbeatFake', () => {
  it('records entries', () => {
    const fake = new HeartbeatFake()
    fake.record('request', { method: 'GET', path: '/' })
    fake.record('query', { sql: 'SELECT 1' })

    expect(fake.all()).toHaveLength(2)
    expect(fake.forType('request')).toHaveLength(1)
    expect(fake.forType('query')).toHaveLength(1)
  })

  describe('hasRecorded', () => {
    it('checks by type', () => {
      const fake = new HeartbeatFake()
      fake.record('request', { path: '/' })

      expect(fake.hasRecorded('request')).toBe(true)
      expect(fake.hasRecorded('query')).toBe(false)
    })

    it('checks by string match', () => {
      const fake = new HeartbeatFake()
      fake.record('request', { method: 'GET', path: '/users' })

      expect(fake.hasRecorded('request', '/users')).toBe(true)
      expect(fake.hasRecorded('request', '/posts')).toBe(false)
    })

    it('checks by regex match', () => {
      const fake = new HeartbeatFake()
      fake.record('request', { method: 'GET', path: '/users/42' })

      expect(fake.hasRecorded('request', /\/users\/\d+/)).toBe(true)
      expect(fake.hasRecorded('request', /\/posts/)).toBe(false)
    })
  })

  describe('assertRecorded', () => {
    it('passes when matching entry exists', () => {
      const fake = new HeartbeatFake()
      fake.record('request', { path: '/test' })
      expect(() => fake.assertRecorded('request')).not.toThrow()
    })

    it('fails when no matching entry', () => {
      const fake = new HeartbeatFake()
      expect(() => fake.assertRecorded('request')).toThrow(/Expected request/)
    })

    it('asserts exact count', () => {
      const fake = new HeartbeatFake()
      fake.record('request', { a: 1 })
      fake.record('request', { a: 2 })
      expect(() => fake.assertRecorded('request', undefined, 2)).not.toThrow()
      expect(() => fake.assertRecorded('request', undefined, 3)).toThrow(/Expected 3/)
    })
  })

  describe('assertNotRecorded', () => {
    it('passes when no matching entry', () => {
      const fake = new HeartbeatFake()
      fake.record('request', { path: '/' })
      expect(() => fake.assertNotRecorded('query')).not.toThrow()
    })

    it('fails when matching entry exists', () => {
      const fake = new HeartbeatFake()
      fake.record('exception', { message: 'oops' })
      expect(() => fake.assertNotRecorded('exception')).toThrow(/Unexpected/)
    })
  })

  describe('assertNothingRecorded', () => {
    it('passes when empty', () => {
      const fake = new HeartbeatFake()
      expect(() => fake.assertNothingRecorded()).not.toThrow()
    })

    it('fails when entries exist', () => {
      const fake = new HeartbeatFake()
      fake.record('request', { x: 1 })
      expect(() => fake.assertNothingRecorded()).toThrow(/Expected no entries/)
    })
  })

  describe('assertRecordedCount', () => {
    it('passes with correct count', () => {
      const fake = new HeartbeatFake()
      fake.record('request', { a: 1 })
      fake.record('query', { b: 2 })
      expect(() => fake.assertRecordedCount(2)).not.toThrow()
    })

    it('fails with wrong count', () => {
      const fake = new HeartbeatFake()
      fake.record('request', { a: 1 })
      expect(() => fake.assertRecordedCount(5)).toThrow(/Expected 5/)
    })
  })

  describe('reset', () => {
    it('clears all entries', () => {
      const fake = new HeartbeatFake()
      fake.record('request', { a: 1 })
      fake.record('query', { b: 2 })
      fake.reset()
      expect(fake.all()).toHaveLength(0)
      expect(() => fake.assertNothingRecorded()).not.toThrow()
    })
  })
})
