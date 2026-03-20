import { Application } from '@mantiq/core'
import type { MailManager } from '../MailManager.ts'
import type { PendingMail } from '../PendingMail.ts'

export const MAIL_MANAGER = Symbol('MailManager')

/** Get the mail manager instance */
export function mail(): MailManager
/** Start a pending mail to the given address */
export function mail(to: string): PendingMail
export function mail(to?: string): MailManager | PendingMail {
  const manager = Application.getInstance().make<MailManager>(MAIL_MANAGER)
  if (to === undefined) return manager
  return manager.to(to)
}
