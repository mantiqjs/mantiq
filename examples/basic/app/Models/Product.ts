import { Model } from '@mantiq/database'

export class Product extends Model {
  static override table = 'products'

  static override fillable = ['name']

  static override hidden = []

  static override casts = {}
}
