import { Model } from '@mantiq/database'

export class MetricModel extends Model {
  static override table = 'heartbeat_metrics'
  static override incrementing = true
  static override keyType = 'int' as const
  static override timestamps = false
  static override fillable = ['name', 'type', 'value', 'tags', 'period', 'bucket', 'created_at']
  static override casts: Record<string, 'int' | 'float' | 'boolean' | 'string' | 'json' | 'date' | 'datetime' | 'array'> = {
    id: 'int',
    value: 'float',
    period: 'int',
    bucket: 'int',
    created_at: 'int',
  }
}
