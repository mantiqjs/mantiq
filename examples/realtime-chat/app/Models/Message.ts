import { Model } from '@mantiq/database'

export class Message extends Model {
  static override table = 'messages'
  static override fillable = ['room_id', 'user_id', 'body', 'type', 'reply_to_id', 'edited_at']
  static override guarded = ['id']
  static override timestamps = true
}
