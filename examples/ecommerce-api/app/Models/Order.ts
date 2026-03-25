import { Model } from '@mantiq/database'

export class Order extends Model {
  static override table = 'orders'
  static override fillable = [
    'user_id', 'order_number', 'status', 'subtotal', 'tax', 'total',
    'shipping_address', 'billing_address', 'notes', 'paid_at', 'shipped_at',
  ]
  static override guarded = ['id']
  static override timestamps = true
}
