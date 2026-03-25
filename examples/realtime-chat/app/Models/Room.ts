import { Model } from '@mantiq/database'

export class Room extends Model {
  static override table = 'rooms'
  static override fillable = ['name', 'description', 'type', 'created_by', 'max_members']
  static override guarded = ['id']
  static override timestamps = true
}
