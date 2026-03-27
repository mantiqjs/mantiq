import type { MailTransport } from './contracts/Transport.ts'
import type { MailConfig, MailerConfig, MailAddress } from './contracts/MailConfig.ts'
import { DEFAULT_CONFIG } from './contracts/MailConfig.ts'
import { Message } from './Message.ts'
import { PendingMail } from './PendingMail.ts'
import { MailError } from './errors/MailError.ts'

import { ArrayTransport } from './drivers/ArrayTransport.ts'
import { LogTransport } from './drivers/LogTransport.ts'
import { SmtpTransport } from './drivers/SmtpTransport.ts'
import { ResendTransport } from './drivers/ResendTransport.ts'
import { SendGridTransport } from './drivers/SendGridTransport.ts'
import { MailgunTransport } from './drivers/MailgunTransport.ts'
import { PostmarkTransport } from './drivers/PostmarkTransport.ts'
import { SesTransport } from './drivers/SesTransport.ts'

/**
 * MailManager — driver manager for mail transports.
 *
 * @example
 *   const manager = new MailManager(config)
 *   await manager.to('user@example.com').send(new WelcomeEmail(user))
 *   await manager.driver('resend').send(message)
 */
export class MailManager {
  /** Hook for observability — called after every mail send. */
  static _onMailSent: ((data: { to: string[]; subject: string; mailer: string; duration: number; queued: boolean }) => void) | null = null

  private config: MailConfig
  private drivers = new Map<string, MailTransport>()
  private customDrivers = new Map<string, () => MailTransport>()

  constructor(config?: Partial<MailConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** Get the default from address */
  getFrom(): MailAddress {
    return this.config.from
  }

  /** Get or create a transport driver by name */
  driver(name?: string): MailTransport {
    const driverName = name ?? this.config.default

    if (this.drivers.has(driverName)) {
      return this.drivers.get(driverName)!
    }

    const transport = this.createDriver(driverName)
    this.drivers.set(driverName, transport)
    return transport
  }

  /** Alias for driver() */
  mailer(name?: string): MailTransport {
    return this.driver(name)
  }

  /** Start a fluent pending mail */
  to(address: string | MailAddress | (string | MailAddress)[]): PendingMail {
    return new PendingMail(this).to(address)
  }

  /** Send a mailable using the default transport */
  async send(mailable: import('./Mailable.ts').Mailable): Promise<{ id: string }> {
    return new PendingMail(this).send(mailable)
  }

  /** Register a custom driver factory */
  extend(name: string, factory: () => MailTransport): void {
    this.customDrivers.set(name, factory)
    this.drivers.delete(name) // clear cached instance
  }

  /** Get the default driver name */
  getDefaultDriver(): string {
    return this.config.default
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private createDriver(name: string): MailTransport {
    // Check custom drivers first
    const customFactory = this.customDrivers.get(name)
    if (customFactory) return customFactory()

    const mailerConfig = this.config.mailers[name]
    if (!mailerConfig) {
      throw new MailError(`Mail driver "${name}" is not configured.`, { available: Object.keys(this.config.mailers) })
    }

    return this.resolveDriver(mailerConfig)
  }

  private resolveDriver(config: MailerConfig): MailTransport {
    switch (config.driver) {
      case 'smtp':
        return new SmtpTransport(config)
      case 'resend':
        return new ResendTransport(config)
      case 'sendgrid':
        return new SendGridTransport(config)
      case 'mailgun':
        return new MailgunTransport(config)
      case 'postmark':
        return new PostmarkTransport(config)
      case 'ses':
        return new SesTransport(config)
      case 'log':
        return new LogTransport()
      case 'array':
        return new ArrayTransport()
      default:
        throw new MailError(`Unsupported mail driver: "${(config as any).driver}"`)
    }
  }
}
