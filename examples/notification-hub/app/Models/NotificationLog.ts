import { Model } from '@mantiq/database'

export class NotificationLog extends Model {
  static override table = 'notification_logs'
  static override fillable = ['user_id', 'template_id', 'channel', 'recipient', 'subject', 'body', 'status', 'error_message', 'sent_at', 'delivered_at', 'metadata']
  static override timestamps = true
}
