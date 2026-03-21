import { HealthCheck } from '../HealthCheck.ts'

/**
 * Verifies the mail driver is configured and accessible.
 * Does NOT send an actual email — just checks the driver can be resolved.
 */
export class MailCheck extends HealthCheck {
  readonly name = 'mail'

  constructor(private mail: any) {
    super()
  }

  override async run(): Promise<void> {
    if (!this.mail) throw new Error('Mail instance is null')

    const driver = this.mail.getDefaultDriver?.() ?? 'unknown'
    this.meta('driver', typeof driver === 'string' ? driver : 'unknown')

    // Try to resolve the transport — this validates config without sending
    try {
      const transport = this.mail.driver?.() ?? this.mail.transport?.()
      if (!transport) {
        this.degrade('Mail transport could not be resolved — check config')
      }
    } catch (e: any) {
      throw new Error(`Mail driver not configured: ${e.message}`)
    }
  }
}
