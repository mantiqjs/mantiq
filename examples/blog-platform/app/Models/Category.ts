import { Model } from '@mantiq/database'

export class Category extends Model {
  static override table = 'categories'
  static override fillable = ['name', 'slug', 'description']
  static override timestamps = true
}
