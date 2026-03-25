import { Model } from '@mantiq/database'

export class Entry extends Model {
  static override table = 'entries'
  static override fillable = [
    'content_type_id', 'title', 'slug', 'data', 'status',
    'author_id', 'published_at', 'version', 'locale',
  ]
  static override guarded = ['id']
  static override timestamps = true
}
