import { Notification } from '@mantiq/notify'
import type { Notifiable } from '@mantiq/notify'
import { OrderShippedMail } from '../Mail/OrderShippedMail.ts'
import type { Order } from '../Models/Order.ts'
import type { User } from '../Models/User.ts'

export class OrderStatusChangedNotification extends Notification {
  constructor(
    private order: Order,
    private user: User,
    private previousStatus: string,
    private newStatus: string,
  ) {
    super()
  }

  override via(_notifiable: Notifiable): string[] {
    // Send mail only when shipping
    if (this.newStatus === 'shipped') {
      return ['mail', 'database']
    }
    return ['database']
  }

  override toMail(_notifiable: Notifiable) {
    const mail = new OrderShippedMail(this.order, this.user)
    const email = this.user.getAttribute('email') as string
    mail.to(email)
    return mail
  }

  override toDatabase(_notifiable: Notifiable) {
    return {
      type: 'order_status_changed',
      order_id: this.order.getAttribute('id'),
      order_number: this.order.getAttribute('order_number'),
      previous_status: this.previousStatus,
      new_status: this.newStatus,
      message: `Order ${this.order.getAttribute('order_number')} status changed from ${this.previousStatus} to ${this.newStatus}.`,
    }
  }
}
