import { Model } from '@mantiq/database'

export class Reaction extends Model {
  static override table = 'reactions'
  static override fillable = ['message_id', 'user_id', 'emoji']
  static override guarded = ['id']
  static override timestamps = true
}
