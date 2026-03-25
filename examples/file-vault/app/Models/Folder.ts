import { Model } from '@mantiq/database'

export class Folder extends Model {
  static override table = 'folders'
  static override fillable = ['name', 'user_id', 'parent_id', 'path']
  static override timestamps = true
}
