import { Model } from '@mantiq/database'

export class CartItem extends Model {
  static override table = 'cart_items'
  static override fillable = ['user_id', 'product_id', 'quantity']
  static override guarded = ['id']
  static override timestamps = true
}
