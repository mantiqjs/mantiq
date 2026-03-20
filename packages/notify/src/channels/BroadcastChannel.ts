import type { NotificationChannel } from '../contracts/Channel.ts'
import type { Notifiable } from '../contracts/Notifiable.ts'
import type { Notification } from '../Notification.ts'
import { NotifyError } from '../errors/NotifyError.ts'

/**
 * Broadcasts notifications via server-sent events using @mantiq/realtime.
 *
 * The notification's `toBroadcast(notifiable)` method should return a
 * `BroadcastPayload` with `{ event, data, channel? }`.
 *
 * If no channel is specified, defaults to `App.User.{notifiable.getKey()}`.
 * If @mantiq/realtime is not installed, the channel skips silently.
 */
export class BroadcastChannel implements NotificationChannel {
  readonly name = 'broadcast'

  async send(notifiable: Notifiable, notification: Notification): Promise<void> {
    const payload = notification.getPayloadFor('broadcast', notifiable)
    if (!payload) return

    // Try to import SSEManager from @mantiq/realtime — skip silently if unavailable
    let SSEManager: any
    let Application: any
    try {
      const realtimeModule = await import('@mantiq/realtime')
      SSEManager = realtimeModule.SSEManager
      const coreModule = await import('@mantiq/core')
      Application = coreModule.Application
    } catch {
      // @mantiq/realtime is not available — skip silently
      return
    }

    const channel = payload.channel ?? `App.User.${notifiable.getKey()}`
    const event = payload.event
    const data = payload.data

    try {
      const sseManager = Application.getInstance().make(SSEManager)
      sseManager.broadcast(channel, event, data)
    } catch (error) {
      throw new NotifyError(`Failed to broadcast notification: ${error instanceof Error ? error.message : String(error)}`, {
        channel: this.name,
        notificationType: notification.type,
        broadcastChannel: channel,
        event,
      })
    }
  }
}
