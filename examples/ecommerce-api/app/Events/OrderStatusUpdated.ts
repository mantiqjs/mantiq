import { Event } from '@mantiq/core'
import type { Order } from '../Models/Order.ts'

export class OrderStatusUpdated extends Event {
  constructor(
    public readonly order: Order,
    public readonly previousStatus: string,
    public readonly newStatus: string,
  ) { super() }
}
