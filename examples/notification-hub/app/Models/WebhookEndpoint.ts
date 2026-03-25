import { Model } from '@mantiq/database'

export class WebhookEndpoint extends Model {
  static override table = 'webhook_endpoints'
  static override fillable = ['user_id', 'url', 'secret', 'events', 'is_active', 'last_delivery_at', 'failure_count']
  static override timestamps = true
}
