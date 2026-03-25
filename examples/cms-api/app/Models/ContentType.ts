import { Model } from '@mantiq/database'

export class ContentType extends Model {
  static override table = 'content_types'
  static override fillable = ['name', 'slug', 'description', 'fields_schema', 'icon']
  static override guarded = ['id']
  static override timestamps = true
}
