import { Event } from '@mantiq/core'
import type { Order } from '../Models/Order.ts'

export class OrderPlaced extends Event {
  constructor(
    public readonly order: Order,
    public readonly userId: number,
  ) { super() }
}
