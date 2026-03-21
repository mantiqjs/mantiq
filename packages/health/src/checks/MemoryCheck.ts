import { HealthCheck } from '../HealthCheck.ts'

/**
 * Checks memory usage against a threshold.
 * Degrades if usage exceeds the warning threshold, fails if critical.
 *
 * @example
 * health.register(new MemoryCheck({ warnAt: 256, criticalAt: 512 })) // MB
 */
export class MemoryCheck extends HealthCheck {
  readonly name = 'memory'

  private warnMB: number
  private criticalMB: number

  constructor(opts: { warnAt?: number; criticalAt?: number } = {}) {
    super()
    this.warnMB = opts.warnAt ?? 256
    this.criticalMB = opts.criticalAt ?? 512
  }

  override async run(): Promise<void> {
    const usage = process.memoryUsage()
    const heapMB = Math.round(usage.heapUsed / 1024 / 1024 * 10) / 10
    const rssMB = Math.round(usage.rss / 1024 / 1024 * 10) / 10

    this.meta('heap', `${heapMB}MB`)
    this.meta('rss', `${rssMB}MB`)
    this.meta('threshold_warn', `${this.warnMB}MB`)
    this.meta('threshold_critical', `${this.criticalMB}MB`)

    if (heapMB >= this.criticalMB) {
      throw new Error(`Heap usage ${heapMB}MB exceeds critical threshold ${this.criticalMB}MB`)
    }

    if (heapMB >= this.warnMB) {
      this.degrade(`Heap usage ${heapMB}MB exceeds warning threshold ${this.warnMB}MB`)
    }
  }
}
