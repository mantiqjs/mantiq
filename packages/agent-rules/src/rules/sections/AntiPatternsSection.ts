import type { RuleSection } from '../RuleRegistry.ts'
import type { DetectedPackage } from '../PackageDetector.ts'

export class AntiPatternsSection implements RuleSection {
  readonly id = 'anti-patterns'
  readonly title = "Do's and Don'ts"
  readonly requires: string[] = []

  render(_packages: DetectedPackage[]): string {
    return `### DO
- Always use the \`override\` keyword when overriding base class members
- Use \`bun mantiq make:*\` commands to generate files instead of writing from scratch
- Import from \`@mantiq/*\` packages, not from internal paths
- Use \`.ts\` file extensions in relative imports
- Use named exports for models, controllers, middleware
- Use \`export default class\` for migrations and seeders
- Return \`Promise<Response>\` from controller methods
- Use \`MantiqResponse.json()\` instead of \`new Response(JSON.stringify(...))\`
- Use \`bun test\` and \`import { describe, test, expect } from 'bun:test'\`

### DON'T
- Don't use Node.js APIs when Bun equivalents exist (\`Bun.write()\` over \`fs.writeFileSync()\`)
- Don't use \`require()\` — this is ESM-only
- Don't use string keys with the container (\`app.make('router')\` will throw)
- Don't forget \`override\` — TypeScript will error with noImplicitOverride
- Don't use \`(faker)\` as Factory.definition parameter — it's \`(index: number, fake: Faker)\`
- Don't pass arguments to \`next()\` in middleware — NextFunction takes no arguments
- Don't use relative paths to import from other @mantiq packages — always use \`@mantiq/*\`
- Don't put controllers in \`app/Controllers/\` — they go in \`app/Http/Controllers/\`
- Don't default export controllers or models — use named exports
- Don't manually create migration files — use \`bun mantiq make:migration\`
- Don't use jest/vitest — use \`bun:test\``
  }
}
