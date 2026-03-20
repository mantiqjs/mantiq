import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { MailChannel } from '../../src/channels/MailChannel.ts'
import { createMockNotifiable, TestNotification } from '../helpers.ts'

describe('MailChannel', () => {
  let channel: MailChannel

  beforeEach(() => {
    channel = new MailChannel()
  })

  it('has correct name', () => {
    expect(channel.name).toBe('mail')
  })

  it('skips when no payload (toMail returns undefined)', async () => {
    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['mail'], {})

    // Should not throw — just silently skip
    await channel.send(notifiable, notification)
  })

  it('calls getPayloadFor with mail channel', async () => {
    let payloadRequested = false

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['mail'], {})
    const originalGetPayload = notification.getPayloadFor.bind(notification)
    notification.getPayloadFor = (ch: string, n: any) => {
      if (ch === 'mail') payloadRequested = true
      return originalGetPayload(ch, n)
    }

    await channel.send(notifiable, notification)
    expect(payloadRequested).toBe(true)
  })

  it('throws NotifyError when @mantiq/mail is not installed', async () => {
    const notifiable = createMockNotifiable()
    // Return a non-null payload so it doesn't skip
    const notification = new TestNotification(['mail'], {
      mail: { subject: 'Test', body: 'Hello' },
    })

    // @mantiq/mail likely cannot be imported in test env, so this should throw
    await expect(channel.send(notifiable, notification)).rejects.toThrow(/MailChannel requires @mantiq\/mail/)
  })
})
