import { describe, test, expect } from 'bun:test'
import { BaseSQLConnection } from '../../src/drivers/BaseSQLConnection.ts'

// Create a testable subclass that exposes the protected methods
class TestConnection extends BaseSQLConnection {
  readonly _grammar: any = {}

  // Track reconnect calls
  reconnectCalls = 0
  shouldFailOnFirstAttempt = false
  private attemptCount = 0

  override async reconnect(): Promise<void> {
    this.reconnectCalls++
  }

  // Expose protected method for testing
  testIsLostConnection(err: any): boolean {
    return this.isLostConnection(err)
  }

  // Expose protected method for testing
  async testWithReconnect<T>(callback: () => Promise<T>): Promise<T> {
    return this.withReconnect(callback)
  }

  // Stub implementations for abstract methods
  async select(): Promise<Record<string, any>[]> { return [] }
  async statement(): Promise<number> { return 0 }
  async insertGetId(): Promise<number | bigint> { return 0 }
  async transaction<T>(cb: any): Promise<T> { return cb(this) }
  schema(): any { return {} }
  getDriverName(): string { return 'test' }
}

describe('Lost Connection Detection', () => {
  describe('isLostConnection()', () => {
    const conn = new TestConnection()

    test('detects "server has gone away"', () => {
      expect(conn.testIsLostConnection(new Error('MySQL server has gone away'))).toBe(true)
    })

    test('detects "connection reset"', () => {
      expect(conn.testIsLostConnection(new Error('read ECONNRESET'))).toBe(true)
    })

    test('detects EPIPE', () => {
      expect(conn.testIsLostConnection(new Error('write EPIPE'))).toBe(true)
    })

    test('detects ETIMEDOUT', () => {
      expect(conn.testIsLostConnection(new Error('connect ETIMEDOUT'))).toBe(true)
    })

    test('detects "lost connection"', () => {
      expect(conn.testIsLostConnection(new Error('Lost connection to MySQL server during query'))).toBe(true)
    })

    test('detects "broken pipe"', () => {
      expect(conn.testIsLostConnection(new Error('Broken pipe'))).toBe(true)
    })

    test('detects "server closed the connection unexpectedly"', () => {
      expect(conn.testIsLostConnection(new Error('server closed the connection unexpectedly'))).toBe(true)
    })

    test('detects "connection timed out"', () => {
      expect(conn.testIsLostConnection(new Error('Connection timed out'))).toBe(true)
    })

    test('does NOT detect regular errors', () => {
      expect(conn.testIsLostConnection(new Error('syntax error'))).toBe(false)
      expect(conn.testIsLostConnection(new Error('table not found'))).toBe(false)
      expect(conn.testIsLostConnection(new Error('constraint violation'))).toBe(false)
    })

    test('handles null/undefined error message', () => {
      expect(conn.testIsLostConnection({})).toBe(false)
      expect(conn.testIsLostConnection(null)).toBe(false)
      expect(conn.testIsLostConnection(undefined)).toBe(false)
    })

    test('case insensitive matching', () => {
      expect(conn.testIsLostConnection(new Error('SERVER HAS GONE AWAY'))).toBe(true)
      expect(conn.testIsLostConnection(new Error('Connection Reset'))).toBe(true)
    })
  })

  describe('withReconnect()', () => {
    test('returns result on success without reconnecting', async () => {
      const conn = new TestConnection()

      const result = await conn.testWithReconnect(async () => 'success')

      expect(result).toBe('success')
      expect(conn.reconnectCalls).toBe(0)
    })

    test('reconnects and retries on lost connection error', async () => {
      const conn = new TestConnection()
      let attempts = 0

      const result = await conn.testWithReconnect(async () => {
        attempts++
        if (attempts === 1) throw new Error('server has gone away')
        return 'recovered'
      })

      expect(result).toBe('recovered')
      expect(conn.reconnectCalls).toBe(1)
      expect(attempts).toBe(2)
    })

    test('throws original error if not a lost connection', async () => {
      const conn = new TestConnection()

      await expect(
        conn.testWithReconnect(async () => {
          throw new Error('syntax error near SELECT')
        })
      ).rejects.toThrow('syntax error near SELECT')

      expect(conn.reconnectCalls).toBe(0)
    })

    test('throws on retry if second attempt also fails', async () => {
      const conn = new TestConnection()

      await expect(
        conn.testWithReconnect(async () => {
          throw new Error('connection reset')
        })
      ).rejects.toThrow('connection reset')

      // Should have tried to reconnect once
      expect(conn.reconnectCalls).toBe(1)
    })
  })
})
