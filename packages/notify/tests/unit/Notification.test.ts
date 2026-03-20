import { describe, it, expect } from 'bun:test'
import { Notification } from '../../src/Notification.ts'
import { createMockNotifiable } from '../helpers.ts'
import type { Notifiable } from '../../src/contracts/Notifiable.ts'

class InvoiceNotification extends Notification {
  override via() { return ['mail', 'database'] }

  toMail(_notifiable: Notifiable) {
    return { subject: 'Invoice', body: 'Your invoice is ready' }
  }

  toDatabase(_notifiable: Notifiable) {
    return { invoice_id: 42, message: 'Invoice generated' }
  }
}

class EmptyNotification extends Notification {
  override via() { return ['webhook'] }
}

describe('Notification', () => {
  describe('id', () => {
    it('generates a UUID', () => {
      const n = new InvoiceNotification()
      expect(n.id).toBeDefined()
      expect(typeof n.id).toBe('string')
      // UUID v4 format: 8-4-4-4-12 hex chars
      expect(n.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    it('generates unique IDs for each instance', () => {
      const a = new InvoiceNotification()
      const b = new InvoiceNotification()
      expect(a.id).not.toBe(b.id)
    })
  })

  describe('type', () => {
    it('returns the class name', () => {
      const n = new InvoiceNotification()
      expect(n.type).toBe('InvoiceNotification')
    })

    it('returns correct name for different classes', () => {
      const n = new EmptyNotification()
      expect(n.type).toBe('EmptyNotification')
    })
  })

  describe('via()', () => {
    it('returns the channels array', () => {
      const n = new InvoiceNotification()
      const notifiable = createMockNotifiable()
      expect(n.via(notifiable)).toEqual(['mail', 'database'])
    })
  })

  describe('getPayloadFor()', () => {
    it('calls toMail for mail channel', () => {
      const n = new InvoiceNotification()
      const notifiable = createMockNotifiable()
      const payload = n.getPayloadFor('mail', notifiable)
      expect(payload).toEqual({ subject: 'Invoice', body: 'Your invoice is ready' })
    })

    it('calls toDatabase for database channel', () => {
      const n = new InvoiceNotification()
      const notifiable = createMockNotifiable()
      const payload = n.getPayloadFor('database', notifiable)
      expect(payload).toEqual({ invoice_id: 42, message: 'Invoice generated' })
    })

    it('returns undefined for missing channel method', () => {
      const n = new InvoiceNotification()
      const notifiable = createMockNotifiable()
      const payload = n.getPayloadFor('slack', notifiable)
      expect(payload).toBeUndefined()
    })

    it('capitalizes channel name correctly (convention: toFoo)', () => {
      const n = new EmptyNotification()
      const notifiable = createMockNotifiable()
      // No toWebhook method on EmptyNotification
      expect(n.getPayloadFor('webhook', notifiable)).toBeUndefined()
    })

    it('passes notifiable to the channel method', () => {
      let receivedNotifiable: Notifiable | null = null

      class SpyNotification extends Notification {
        override via() { return ['sms'] }
        toSms(notifiable: Notifiable) {
          receivedNotifiable = notifiable
          return { body: 'test' }
        }
      }

      const notifiable = createMockNotifiable({ key: 99 })
      const n = new SpyNotification()
      n.getPayloadFor('sms', notifiable)
      expect(receivedNotifiable).not.toBeNull()
      expect(receivedNotifiable!.getKey()).toBe(99)
    })
  })

  describe('queueing properties', () => {
    it('has sensible defaults', () => {
      const n = new InvoiceNotification()
      expect(n.shouldQueue).toBe(false)
      expect(n.tries).toBe(3)
      expect(n.queue).toBeUndefined()
      expect(n.connection).toBeUndefined()
    })
  })
})
