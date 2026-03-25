import { Model } from '@mantiq/database'

export class Product extends Model {
  static override table = 'products'
  static override fillable = [
    'name', 'slug', 'description', 'price', 'compare_at_price',
    'sku', 'stock_quantity', 'category_id', 'status', 'featured',
  ]
  static override guarded = ['id']
  static override timestamps = true
}
