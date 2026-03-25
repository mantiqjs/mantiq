import { Model } from '@mantiq/database'

export class NotificationTemplate extends Model {
  static override table = 'notification_templates'
  static override fillable = ['name', 'channel', 'subject', 'body', 'variables', 'is_active']
  static override timestamps = true
}
