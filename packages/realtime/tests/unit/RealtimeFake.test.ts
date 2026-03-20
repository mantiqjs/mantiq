import { describe, it, expect, beforeEach } from 'bun:test'
import { RealtimeFake } from '../../src/testing/RealtimeFake.ts'

describe('RealtimeFake', () => {
  let fake: RealtimeFake

  beforeEach(() => {
    fake = new RealtimeFake()
  })

  // ── Broadcast assertions ───────────────────────────────────────────────

  it('records and asserts broadcasts', () => {
    fake.broadcast('orders.1', 'OrderShipped', { orderId: 1 })
    fake.assertBroadcast('OrderShipped')
    fake.assertBroadcastOn('orders.1', 'OrderShipped')
  })

  it('assertBroadcast throws when not broadcast', () => {
    expect(() => fake.assertBroadcast('OrderShipped')).toThrow('Expected [OrderShipped]')
  })

  it('assertBroadcastOn throws when not on correct channel', () => {
    fake.broadcast('orders.1', 'OrderShipped', {})
    expect(() => fake.assertBroadcastOn('orders.2', 'OrderShipped')).toThrow('channel "orders.2"')
  })

  it('assertBroadcastCount verifies count', () => {
    fake.broadcast('ch', 'Evt', {})
    fake.broadcast('ch', 'Evt', {})
    fake.assertBroadcastCount('Evt', 2)
    expect(() => fake.assertBroadcastCount('Evt', 3)).toThrow('2 time(s)')
  })

  it('assertNotBroadcast passes when not broadcast', () => {
    fake.assertNotBroadcast('OrderShipped')
  })

  it('assertNotBroadcast throws when broadcast', () => {
    fake.broadcast('ch', 'OrderShipped', {})
    expect(() => fake.assertNotBroadcast('OrderShipped')).toThrow('Unexpected [OrderShipped]')
  })

  it('assertNothingBroadcast passes when empty', () => {
    fake.assertNothingBroadcast()
  })

  it('assertNothingBroadcast throws when broadcasts exist', () => {
    fake.broadcast('ch', 'Evt', {})
    expect(() => fake.assertNothingBroadcast()).toThrow('Evt')
  })

  it('supports predicate in assertBroadcast', () => {
    fake.broadcast('ch', 'OrderShipped', { orderId: 1 })
    fake.assertBroadcast('OrderShipped', (data) => data.orderId === 1)
    expect(() => {
      fake.assertBroadcast('OrderShipped', (data) => data.orderId === 999)
    }).toThrow()
  })

  // ── Subscription assertions ────────────────────────────────────────────

  it('records and asserts subscriptions', () => {
    fake.subscribe('orders.1', 'user1')
    fake.assertSubscribed('orders.1')
    fake.assertSubscribed('orders.1', 'user1')
  })

  it('assertSubscribed throws when not subscribed', () => {
    expect(() => fake.assertSubscribed('orders.1')).toThrow('subscription')
  })

  it('assertNotSubscribed passes when not subscribed', () => {
    fake.assertNotSubscribed('orders.1')
  })

  it('assertNotSubscribed throws when subscribed', () => {
    fake.subscribe('orders.1')
    expect(() => fake.assertNotSubscribed('orders.1')).toThrow('Unexpected')
  })

  // ── Reset ──────────────────────────────────────────────────────────────

  it('reset clears all records', () => {
    fake.broadcast('ch', 'Evt', {})
    fake.subscribe('ch')
    fake.reset()
    expect(fake.allBroadcasts()).toHaveLength(0)
    expect(fake.allSubscriptions()).toHaveLength(0)
  })
})
