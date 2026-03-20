import { Application } from '@mantiq/core'
import type { NotificationManager } from '../NotificationManager.ts'

export const NOTIFY_MANAGER = Symbol('NotificationManager')

export function notify(): NotificationManager {
  return Application.getInstance().make<NotificationManager>(NOTIFY_MANAGER)
}
