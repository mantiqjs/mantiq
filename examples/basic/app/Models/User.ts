import { Model } from '@mantiq/database'

export class User extends Model {
  static override table = 'users'
  static override fillable = ['name', 'email', 'role']
  static override guarded = ['id']
  static override hidden = ['created_at', 'updated_at']
  static override timestamps = true
}
