import { Model } from '@mantiq/database'

export class ExceptionGroupModel extends Model {
  static override table = 'heartbeat_exception_groups'
  static override primaryKey = 'fingerprint'
  static override incrementing = false
  static override keyType = 'string' as const
  static override timestamps = false
  static override fillable = [
    'fingerprint', 'class', 'message', 'count',
    'first_seen_at', 'last_seen_at', 'last_entry_uuid', 'resolved_at',
  ]
  static override casts: Record<string, 'int' | 'float' | 'boolean' | 'string' | 'json' | 'date' | 'datetime' | 'array'> = {
    count: 'int',
    first_seen_at: 'int',
    last_seen_at: 'int',
    resolved_at: 'int',
  }
}
