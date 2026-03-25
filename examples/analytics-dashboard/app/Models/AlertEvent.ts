import { Model } from '@mantiq/database'

export class AlertEvent extends Model {
  static override table = 'alert_events'
  static override fillable = ['alert_id', 'metric_value', 'triggered_at', 'resolved_at', 'acknowledged']
  static override timestamps = true
  static override casts = { triggered_at: 'datetime', resolved_at: 'datetime' } as const
}
