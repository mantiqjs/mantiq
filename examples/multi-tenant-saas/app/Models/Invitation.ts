import { Model } from '@mantiq/database'

export class Invitation extends Model {
  static override table = 'invitations'
  static override fillable = [
    'tenant_id', 'email', 'role', 'token', 'invited_by',
    'accepted_at', 'expires_at',
  ]
  static override guarded = ['id']
  static override timestamps = true
}
