import { Job } from '@mantiq/queue'
import { Order } from '../Models/Order.ts'
import { User } from '../Models/User.ts'
import { OrderConfirmationMail } from '../Mail/OrderConfirmationMail.ts'

export class SendOrderConfirmationEmail extends Job {
  override queue = 'emails'
  override tries = 3
  override backoff = 'exponential:10'

  constructor(
    public orderId: number,
    public userId: number,
  ) {
    super()
  }

  override async handle(): Promise<void> {
    const order = await Order.find(this.orderId)
    if (!order) return

    const user = await User.find(this.userId)
    if (!user) return

    const mail = new OrderConfirmationMail(order, user)
    const email = user.getAttribute('email') as string
    mail.to(email)
    mail.build()

    // In production, send via MailManager; with log driver, build() logs it
    console.log(`[SendOrderConfirmationEmail] Confirmation email prepared for order ${order.getAttribute('order_number')} to ${email}`)
  }

  override async failed(error: Error): Promise<void> {
    console.error(`[SendOrderConfirmationEmail] Failed for order ${this.orderId}: ${error.message}`)
  }
}
