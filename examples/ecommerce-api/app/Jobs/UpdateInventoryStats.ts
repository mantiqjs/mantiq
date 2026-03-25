import { Job } from '@mantiq/queue'
import { Product } from '../Models/Product.ts'

export class UpdateInventoryStats extends Job {
  override queue = 'inventory'
  override tries = 3

  constructor(public productId: number) {
    super()
  }

  override async handle(): Promise<void> {
    const product = await Product.find(this.productId)
    if (!product) return

    const stock = product.getAttribute('stock_quantity') as number
    const name = product.getAttribute('name') as string

    if (stock <= 0) {
      console.log(`[UpdateInventoryStats] Product "${name}" is out of stock`)
    } else if (stock <= 5) {
      console.log(`[UpdateInventoryStats] Product "${name}" has low stock: ${stock} remaining`)
    } else {
      console.log(`[UpdateInventoryStats] Product "${name}" stock level: ${stock}`)
    }
  }

  override async failed(error: Error): Promise<void> {
    console.error(`[UpdateInventoryStats] Failed for product ${this.productId}: ${error.message}`)
  }
}
