import { Model } from '@mantiq/database'

export class SpanModel extends Model {
  static override table = 'heartbeat_spans'
  static override incrementing = true
  static override keyType = 'int' as const
  static override timestamps = false
  static override fillable = [
    'trace_id', 'span_id', 'parent_span_id', 'name', 'type', 'status',
    'start_time', 'end_time', 'duration', 'attributes', 'events', 'created_at',
  ]
  static override casts: Record<string, 'int' | 'float' | 'boolean' | 'string' | 'json' | 'date' | 'datetime' | 'array'> = {
    id: 'int',
    start_time: 'int',
    end_time: 'int',
    duration: 'float',
    created_at: 'int',
  }
}
