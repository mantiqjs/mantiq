import { Model } from '@mantiq/database'

export class EntryModel extends Model {
  static override table = 'heartbeat_entries'
  static override timestamps = false
  static override fillable = ['uuid', 'type', 'request_id', 'content', 'tags', 'created_at']
  static override casts: Record<string, string> = {
    id: 'int',
    created_at: 'int',
  }
}
