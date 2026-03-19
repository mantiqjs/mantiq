import { Model } from '@mantiq/database'

export class ProductItem extends Model {
  static override table = 'product_items'

  static override fillable = ['name']

  static override hidden = []

  static override casts = {}
}
