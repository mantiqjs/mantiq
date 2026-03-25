import { Model } from '@mantiq/database'

export class Revision extends Model {
  static override table = 'revisions'
  static override fillable = [
    'entry_id', 'version', 'data', 'title', 'status',
    'changed_by', 'change_summary',
  ]
  static override guarded = ['id']
  static override timestamps = true
}
