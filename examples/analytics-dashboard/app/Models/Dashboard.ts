import { Model } from '@mantiq/database'

export class Dashboard extends Model {
  static override table = 'dashboards'
  static override fillable = ['name', 'description', 'user_id', 'layout', 'is_public']
  static override timestamps = true
}
