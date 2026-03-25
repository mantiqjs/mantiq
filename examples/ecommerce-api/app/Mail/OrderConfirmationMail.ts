import { Mailable } from '@mantiq/mail'
import type { Order } from '../Models/Order.ts'
import type { User } from '../Models/User.ts'

export class OrderConfirmationMail extends Mailable {
  constructor(
    private order: Order,
    private user: User,
  ) {
    super()
  }

  override build(): void {
    const orderNumber = this.order.getAttribute('order_number') as string
    const total = (this.order.getAttribute('total') as number) / 100
    const userName = this.user.getAttribute('name') as string

    this.setSubject(`Order Confirmation - ${orderNumber}`)
    this.markdown([
      `# Order Confirmed!`,
      ``,
      `Hi ${userName},`,
      ``,
      `Thank you for your order **${orderNumber}**.`,
      ``,
      `**Order Total:** $${total.toFixed(2)}`,
      ``,
      `We will notify you when your order ships.`,
      ``,
      `---`,
      ``,
      `*E-Commerce API - Powered by MantiqJS*`,
    ].join('\n'))
  }
}
