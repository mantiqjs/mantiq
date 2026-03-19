import { Model } from '@mantiq/database'

export class ExceptionGroupModel extends Model {
  static override table = 'heartbeat_exception_groups'
  static override primaryKey = 'fingerprint'
  static override timestamps = false
  static override fillable = [
    'fingerprint', 'class', 'message', 'count',
    'first_seen_at', 'last_seen_at', 'last_entry_uuid', 'resolved_at',
  ]
  static override casts: Record<string, string> = {
    count: 'int',
    first_seen_at: 'int',
    last_seen_at: 'int',
    resolved_at: 'int',
  }
}
