import { Model } from '@mantiq/database'

export class Subscription extends Model {
  static override table = 'subscriptions'
  static override fillable = [
    'tenant_id', 'plan_id', 'status',
    'trial_ends_at', 'current_period_start', 'current_period_end',
    'cancelled_at',
  ]
  static override guarded = ['id']
  static override timestamps = true
}
