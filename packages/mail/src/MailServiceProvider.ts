import { ServiceProvider, ConfigRepository } from '@mantiq/core'
import { MailManager } from './MailManager.ts'
import { MAIL_MANAGER } from './helpers/mail.ts'
import type { MailConfig } from './contracts/MailConfig.ts'
import { DEFAULT_CONFIG } from './contracts/MailConfig.ts'

export class MailServiceProvider extends ServiceProvider {
  override register(): void {
    const config = this.app.make(ConfigRepository).get<MailConfig>('mail', DEFAULT_CONFIG)

    this.app.singleton(MailManager, () => new MailManager(config))
    this.app.alias(MailManager, MAIL_MANAGER)
  }
}
