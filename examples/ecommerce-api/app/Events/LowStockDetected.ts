import { Event } from '@mantiq/core'
import type { Product } from '../Models/Product.ts'

export class LowStockDetected extends Event {
  constructor(
    public readonly product: Product,
    public readonly currentStock: number,
  ) { super() }
}
