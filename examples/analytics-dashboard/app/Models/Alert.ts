import { Model } from '@mantiq/database'

export class Alert extends Model {
  static override table = 'alerts'
  static override fillable = [
    'name', 'metric_name', 'condition', 'threshold',
    'window_seconds', 'channel', 'channel_target',
    'is_active', 'last_triggered_at', 'cooldown_seconds',
  ]
  static override timestamps = true
  static override casts = { last_triggered_at: 'datetime' } as const
}
