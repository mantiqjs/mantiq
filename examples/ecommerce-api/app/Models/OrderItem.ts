import { Model } from '@mantiq/database'

export class OrderItem extends Model {
  static override table = 'order_items'
  static override fillable = ['order_id', 'product_id', 'quantity', 'unit_price', 'total']
  static override guarded = ['id']
  static override timestamps = false
}
