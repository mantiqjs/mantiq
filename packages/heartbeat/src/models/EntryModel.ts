import { Model } from '@mantiq/database'

export class EntryModel extends Model {
  static override table = 'heartbeat_entries'
  static override incrementing = true
  static override keyType = 'int' as const
  static override timestamps = false
  static override fillable = ['uuid', 'type', 'request_id', 'origin_type', 'origin_id', 'content', 'tags', 'created_at']
  static override casts: Record<string, 'int' | 'float' | 'boolean' | 'string' | 'json' | 'date' | 'datetime' | 'array'> = {
    id: 'int',
    created_at: 'int',
  }
}
