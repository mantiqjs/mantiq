import type { RuleSection } from '../RuleRegistry.ts'
import type { DetectedPackage } from '../PackageDetector.ts'

export class OverviewSection implements RuleSection {
  readonly id = 'overview'
  readonly title = 'Framework Overview'
  readonly requires: string[] = []

  render(_packages: DetectedPackage[]): string {
    return `MantiqJS is a full-stack TypeScript web framework for Bun (>=1.1.0). It follows Laravel-inspired conventions with a modular package system under \`@mantiq/*\`.

Key characteristics:
- **Runtime**: Bun (not Node.js) — use \`bun test\`, \`bun run\`, Bun APIs
- **TypeScript**: strict mode with \`noImplicitOverride: true\` — all base class overrides MUST use \`override\`
- **ESM only**: \`"type": "module"\` — use \`import\`, never \`require()\`
- **File extensions**: use \`.ts\` extensions in relative imports (e.g., \`import { X } from './file.ts'\`)
- **Named exports**: use named exports for models, controllers, middleware (not default exports, except migrations/seeders)`
  }
}
