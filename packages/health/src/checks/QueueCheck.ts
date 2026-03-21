import { HealthCheck } from '../HealthCheck.ts'

/**
 * Verifies the queue driver is accessible and can report its size.
 */
export class QueueCheck extends HealthCheck {
  readonly name = 'queue'

  constructor(private queue: any) {
    super()
  }

  override async run(): Promise<void> {
    if (!this.queue) throw new Error('Queue instance is null')

    const driver = this.queue.getDefaultDriver?.() ?? 'unknown'
    this.meta('driver', typeof driver === 'string' ? driver : 'unknown')

    try {
      const size = await this.queue.size?.('default')
      this.meta('pending', size ?? 0)
    } catch (e: any) {
      throw new Error(`Queue driver not accessible: ${e.message}`)
    }
  }
}
