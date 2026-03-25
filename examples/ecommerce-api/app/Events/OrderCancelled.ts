import { Event } from '@mantiq/core'
import type { Order } from '../Models/Order.ts'

export class OrderCancelled extends Event {
  constructor(
    public readonly order: Order,
    public readonly userId: number,
  ) { super() }
}
