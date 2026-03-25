import { Model } from '@mantiq/database'

export class AuditLog extends Model {
  static override table = 'audit_logs'
  static override fillable = [
    'tenant_id', 'user_id', 'action', 'entity_type', 'entity_id',
    'old_values', 'new_values', 'ip_address',
  ]
  static override guarded = ['id']
  static override timestamps = true
}
