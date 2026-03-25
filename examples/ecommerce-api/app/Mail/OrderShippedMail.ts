import { Mailable } from '@mantiq/mail'
import type { Order } from '../Models/Order.ts'
import type { User } from '../Models/User.ts'

export class OrderShippedMail extends Mailable {
  constructor(
    private order: Order,
    private user: User,
  ) {
    super()
  }

  override build(): void {
    const orderNumber = this.order.getAttribute('order_number') as string
    const userName = this.user.getAttribute('name') as string

    this.setSubject(`Your Order ${orderNumber} Has Shipped!`)
    this.markdown([
      `# Your Order Has Shipped!`,
      ``,
      `Hi ${userName},`,
      ``,
      `Great news! Your order **${orderNumber}** has been shipped.`,
      ``,
      `You can track your delivery status in your account.`,
      ``,
      `---`,
      ``,
      `*E-Commerce API - Powered by MantiqJS*`,
    ].join('\n'))
  }
}
