import { Model } from '@mantiq/database'

export class Category extends Model {
  static override table = 'categories'
  static override fillable = ['name', 'slug', 'description', 'parent_id']
  static override guarded = ['id']
  static override timestamps = true
}
