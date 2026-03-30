import type { RuleSection } from '../RuleRegistry.ts'
import type { DetectedPackage } from '../PackageDetector.ts'

export class CommandsSection implements RuleSection {
  readonly id = 'commands'
  readonly title = 'Available Commands'
  readonly requires: string[] = []

  render(packages: DetectedPackage[]): string {
    const installed = new Set(packages.filter((p) => p.installed).map((p) => p.name))

    let out = `IMPORTANT: Always prefer \`bun mantiq make:*\` generators over manually creating files.

### Code Generation
- \`bun mantiq make:model <Name> [--migration] [--factory] [--seed]\`
- \`bun mantiq make:controller <Name> [--resource]\`
- \`bun mantiq make:middleware <Name>\`
- \`bun mantiq make:request <Name>\`
- \`bun mantiq make:migration <name>\`
- \`bun mantiq make:seeder <Name>\`
- \`bun mantiq make:factory <Name>\`
- \`bun mantiq make:provider <Name>\`
- \`bun mantiq make:command <Name>\`
- \`bun mantiq make:event <Name>\`
- \`bun mantiq make:listener <Name>\`
- \`bun mantiq make:observer <Name>\`
- \`bun mantiq make:job <Name>\`
- \`bun mantiq make:mail <Name>\`
- \`bun mantiq make:notification <Name>\`
- \`bun mantiq make:rule <Name>\`
- \`bun mantiq make:policy <Name>\`
- \`bun mantiq make:exception <Name>\`
- \`bun mantiq make:test <Name> [--unit]\``

    if (installed.has('database')) {
      out += `

### Database
- \`bun mantiq migrate\` — run pending migrations
- \`bun mantiq migrate:rollback\` — rollback last batch
- \`bun mantiq migrate:fresh\` — drop all tables and re-migrate
- \`bun mantiq migrate:status\` — show migration status
- \`bun mantiq seed\` — run database seeders
- \`bun mantiq schema:generate\` — generate TypeScript interfaces from DB`
    }

    out += `

### Utility
- \`bun mantiq serve\` — start dev server
- \`bun mantiq route:list\` — list all registered routes
- \`bun mantiq key:generate\` — generate APP_KEY
- \`bun mantiq about\` — show app info`

    if (installed.has('ai')) {
      out += `
- \`bun mantiq ai:chat\` — interactive AI chat REPL
- \`bun mantiq make:ai-tool <Name>\` — generate AI agent tool`
    }

    if (installed.has('agent-rules')) {
      out += `
- \`bun mantiq agent:generate\` — regenerate AI agent context files`
    }

    return out
  }
}
