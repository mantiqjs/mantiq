import type { RuleSection } from '../RuleRegistry.ts'
import type { DetectedPackage } from '../PackageDetector.ts'

export class StudioSection implements RuleSection {
  readonly id = 'studio'
  readonly title = 'Admin Panel (@mantiq/studio)'
  readonly requires = ['studio']

  render(_packages: DetectedPackage[]): string {
    return `- Studio panels go in \`app/Studio/\`, extend \`StudioPanel\`
- Resources extend \`Resource\` from \`@mantiq/studio\`
- Auto-discovered from \`app/Studio/\` directory
- Generate: \`bun mantiq make:panel <Name>\`, \`bun mantiq make:resource <Name>\`
- Vite plugin: import \`@mantiq/studio/vite\` for dev hot reload`
  }
}
