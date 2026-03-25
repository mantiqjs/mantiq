import { Notification } from '@mantiq/notify'
import type { Notifiable } from '@mantiq/notify'
import type { Product } from '../Models/Product.ts'

export class LowStockNotification extends Notification {
  constructor(
    private product: Product,
    private currentStock: number,
  ) {
    super()
  }

  override via(_notifiable: Notifiable): string[] {
    return ['database']
  }

  override toDatabase(_notifiable: Notifiable) {
    return {
      type: 'low_stock',
      product_id: this.product.getAttribute('id'),
      product_name: this.product.getAttribute('name'),
      sku: this.product.getAttribute('sku'),
      current_stock: this.currentStock,
      message: `Product "${this.product.getAttribute('name')}" (SKU: ${this.product.getAttribute('sku')}) is running low with ${this.currentStock} units remaining.`,
    }
  }
}
