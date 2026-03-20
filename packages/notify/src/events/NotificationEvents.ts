import type { Notifiable } from '../contracts/Notifiable.ts'
import type { Notification } from '../Notification.ts'

export class NotificationSending {
  constructor(
    public readonly notifiable: Notifiable,
    public readonly notification: Notification,
    public readonly channel: string,
  ) {}
}

export class NotificationSent {
  constructor(
    public readonly notifiable: Notifiable,
    public readonly notification: Notification,
    public readonly channel: string,
  ) {}
}

export class NotificationFailed {
  constructor(
    public readonly notifiable: Notifiable,
    public readonly notification: Notification,
    public readonly channel: string,
    public readonly error: Error,
  ) {}
}
