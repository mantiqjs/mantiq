import { Model } from '@mantiq/database'

export class Plan extends Model {
  static override table = 'plans'
  static override fillable = [
    'name', 'slug', 'price', 'features', 'max_users', 'max_storage', 'is_active',
  ]
  static override guarded = ['id']
  static override timestamps = true
}
