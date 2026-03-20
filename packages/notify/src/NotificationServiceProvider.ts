import { ServiceProvider, ConfigRepository } from '@mantiq/core'
import { NotificationManager } from './NotificationManager.ts'
import { NOTIFY_MANAGER } from './helpers/notify.ts'
import type { NotifyConfig } from './contracts/NotifyConfig.ts'
import { DEFAULT_CONFIG } from './contracts/NotifyConfig.ts'

export class NotificationServiceProvider extends ServiceProvider {
  override register(): void {
    const config = this.app.make(ConfigRepository).get<NotifyConfig>('notify', DEFAULT_CONFIG)

    this.app.singleton(NotificationManager, () => new NotificationManager(config))
    this.app.alias(NotificationManager, NOTIFY_MANAGER)
  }
}
