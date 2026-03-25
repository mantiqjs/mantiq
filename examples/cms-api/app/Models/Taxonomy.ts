import { Model } from '@mantiq/database'

export class Taxonomy extends Model {
  static override table = 'taxonomies'
  static override fillable = ['name', 'slug', 'type', 'description', 'parent_id']
  static override guarded = ['id']
  static override timestamps = true
}
