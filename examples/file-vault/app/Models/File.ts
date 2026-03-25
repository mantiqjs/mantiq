import { Model } from '@mantiq/database'

export class File extends Model {
  static override table = 'files'
  static override fillable = ['name', 'stored_name', 'user_id', 'folder_id', 'mime_type', 'size', 'checksum', 'encrypted', 'description']
  static override timestamps = true
}
