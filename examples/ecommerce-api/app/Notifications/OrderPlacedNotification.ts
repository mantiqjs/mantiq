import { Notification } from '@mantiq/notify'
import type { Notifiable } from '@mantiq/notify'
import { OrderConfirmationMail } from '../Mail/OrderConfirmationMail.ts'
import type { Order } from '../Models/Order.ts'
import type { User } from '../Models/User.ts'

export class OrderPlacedNotification extends Notification {
  constructor(
    private order: Order,
    private user: User,
  ) {
    super()
  }

  override via(_notifiable: Notifiable): string[] {
    return ['mail', 'database']
  }

  override toMail(_notifiable: Notifiable) {
    const mail = new OrderConfirmationMail(this.order, this.user)
    const email = this.user.getAttribute('email') as string
    mail.to(email)
    return mail
  }

  override toDatabase(_notifiable: Notifiable) {
    return {
      type: 'order_placed',
      order_id: this.order.getAttribute('id'),
      order_number: this.order.getAttribute('order_number'),
      total: this.order.getAttribute('total'),
      message: `Order ${this.order.getAttribute('order_number')} has been placed successfully.`,
    }
  }
}
