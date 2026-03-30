import type { RuleSection } from '../RuleRegistry.ts'
import type { DetectedPackage } from '../PackageDetector.ts'

export class QueueSection implements RuleSection {
  readonly id = 'queue'
  readonly title = 'Queues & Jobs (@mantiq/queue)'
  readonly requires = ['queue']

  render(_packages: DetectedPackage[]): string {
    return `- Jobs go in \`app/Jobs/\`, extend \`Job\` from \`@mantiq/queue\`
- Dispatch: \`new ProcessPayment({ orderId: 1 }).dispatch()\`
- Override \`tries\`, \`backoff\`, \`handle()\`, \`failed(error)\`
- Queue worker: \`bun mantiq queue:work\`
- Drivers: \`sync\` (default), \`redis\`, \`database\``
  }
}
