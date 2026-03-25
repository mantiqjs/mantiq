import { Model } from '@mantiq/database'

export class Tag extends Model {
  static override table = 'tags'
  static override fillable = ['name', 'slug']
  static override timestamps = true
}
