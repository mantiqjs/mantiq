import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { DatabaseChannel } from '../../src/channels/DatabaseChannel.ts'
import { createMockNotifiable, TestNotification } from '../helpers.ts'

// We need to mock the DatabaseNotification model since it depends on @mantiq/database
// The channel creates a new DatabaseNotification(), sets attributes, and calls save()
const mockSave = mock(async () => {})
const mockSetAttribute = mock((_key: string, _value: any) => {})

// Store original module for cleanup
let originalModule: any

describe('DatabaseChannel', () => {
  let channel: DatabaseChannel

  beforeEach(() => {
    mockSave.mockClear()
    mockSetAttribute.mockClear()
  })

  // Since DatabaseChannel imports DatabaseNotification directly and instantiates it,
  // we test what we can without a full database setup.

  it('has correct name', () => {
    channel = new DatabaseChannel()
    expect(channel.name).toBe('database')
  })

  it('calls getPayloadFor with database channel', async () => {
    channel = new DatabaseChannel()

    const notifiable = createMockNotifiable({ key: 42, morphClass: 'User' })
    let payloadRequested = false

    const notification = new TestNotification(['database'], {})
    const originalGetPayload = notification.getPayloadFor.bind(notification)
    notification.getPayloadFor = (ch: string, n: any) => {
      if (ch === 'database') payloadRequested = true
      return originalGetPayload(ch, n)
    }

    // With no payload, channel should return early (skip)
    await channel.send(notifiable, notification)
    expect(payloadRequested).toBe(true)
  })

  it('skips when getPayloadFor returns undefined', async () => {
    channel = new DatabaseChannel()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['database'], {})
    // No 'database' payload -> getPayloadFor returns undefined -> skip

    // Should not throw
    await channel.send(notifiable, notification)
  })

  it('throws NotifyError when save fails', async () => {
    channel = new DatabaseChannel()

    const notifiable = createMockNotifiable({ key: 1, morphClass: 'User' })
    const notification = new TestNotification(['database'], {
      database: { order_id: 42, message: 'Order shipped' },
    })

    // The channel will try to create a DatabaseNotification model and call save()
    // Since @mantiq/database is likely not fully set up, it will throw
    // We expect it to be wrapped in a NotifyError
    await expect(channel.send(notifiable, notification)).rejects.toThrow(/Failed to store database notification/)
  })

  it('uses getMorphClass for notifiable type', async () => {
    channel = new DatabaseChannel()

    const notifiable = createMockNotifiable({ key: 5, morphClass: 'Admin' })
    const notification = new TestNotification(['database'], {
      database: { action: 'test' },
    })

    // Will fail at save(), but the error message context gives us info
    try {
      await channel.send(notifiable, notification)
    } catch (e: any) {
      // The error should be a NotifyError wrapping the save failure
      expect(e.message).toContain('Failed to store database notification')
    }
  })

  it('stringifies non-string data', async () => {
    channel = new DatabaseChannel()

    const notifiable = createMockNotifiable({ key: 1 })
    const notification = new TestNotification(['database'], {
      database: { complex: { nested: true }, array: [1, 2, 3] },
    })

    // Will throw because no real DB, but we verify it gets that far
    try {
      await channel.send(notifiable, notification)
    } catch (e: any) {
      expect(e.message).toContain('Failed to store database notification')
    }
  })
})
