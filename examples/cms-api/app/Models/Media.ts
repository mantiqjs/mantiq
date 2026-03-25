import { Model } from '@mantiq/database'

export class Media extends Model {
  static override table = 'media'
  static override fillable = [
    'filename', 'original_name', 'mime_type', 'size',
    'path', 'alt_text', 'caption', 'user_id', 'folder',
  ]
  static override guarded = ['id']
  static override timestamps = true
}
