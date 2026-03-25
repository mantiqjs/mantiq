import { Model } from '@mantiq/database'

export class NotificationGroup extends Model {
  static override table = 'notification_groups'
  static override fillable = ['name', 'description', 'user_id', 'members']
  static override timestamps = true
}
