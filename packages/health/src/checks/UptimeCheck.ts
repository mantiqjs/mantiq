import { HealthCheck } from '../HealthCheck.ts'

/**
 * Reports process uptime. Always passes.
 */
export class UptimeCheck extends HealthCheck {
  readonly name = 'uptime'

  override async run(): Promise<void> {
    const seconds = Math.floor(process.uptime())
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    const parts: string[] = []
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    parts.push(`${secs}s`)

    this.meta('seconds', seconds)
    this.meta('formatted', parts.join(' '))
    this.meta('pid', process.pid)
  }
}
