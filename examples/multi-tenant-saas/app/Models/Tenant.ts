import { Model } from '@mantiq/database'

export class Tenant extends Model {
  static override table = 'tenants'
  static override fillable = [
    'name', 'slug', 'domain', 'plan', 'status',
    'settings', 'max_users', 'max_storage',
  ]
  static override guarded = ['id']
  static override timestamps = true
}
