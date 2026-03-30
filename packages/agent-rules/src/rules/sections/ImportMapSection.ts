import type { RuleSection } from '../RuleRegistry.ts'
import type { DetectedPackage } from '../PackageDetector.ts'

export class ImportMapSection implements RuleSection {
  readonly id = 'import-map'
  readonly title = 'Import Cheat Sheet'
  readonly requires: string[] = []

  render(packages: DetectedPackage[]): string {
    const installed = new Set(packages.filter((p) => p.installed).map((p) => p.name))

    const rows: [string, string][] = [
      ['`MantiqRequest` (type)', '`@mantiq/core`'],
      ['`MantiqResponse`', '`@mantiq/core`'],
      ['`Router` (type)', '`@mantiq/core`'],
      ['`Middleware`, `NextFunction` (types)', '`@mantiq/core`'],
      ['`ServiceProvider`', '`@mantiq/core`'],
      ['`MantiqError`', '`@mantiq/core`'],
      ['`env()`', '`@mantiq/core`'],
    ]

    if (installed.has('database')) {
      rows.push(
        ['`Model`', '`@mantiq/database`'],
        ['`Migration`, `SchemaBuilder` (type)', '`@mantiq/database`'],
        ['`Factory`, `Faker`', '`@mantiq/database`'],
        ['`Seeder`', '`@mantiq/database`'],
      )
    }

    if (installed.has('validation')) {
      rows.push(['`FormRequest`', '`@mantiq/validation`'])
    }

    rows.push(['`Command`, `ParsedArgs` (type)', '`@mantiq/cli`'])

    if (installed.has('queue')) rows.push(['`Job`', '`@mantiq/queue`'])
    if (installed.has('mail')) rows.push(['`Mailable`', '`@mantiq/mail`'])
    if (installed.has('notify')) rows.push(['`Notification`, `Notifiable` (type)', '`@mantiq/notify`'])
    if (installed.has('auth')) rows.push(['`Policy`', '`@mantiq/auth`'])
    if (installed.has('testing')) rows.push(['`TestCase`, `TestClient`', '`@mantiq/testing`'])
    if (installed.has('ai')) rows.push(['`AIManager`, `AgentTool`', '`@mantiq/ai`'])

    let table = '| Class / Type | Package |\n|---|---|\n'
    for (const [cls, pkg] of rows) {
      table += `| ${cls} | ${pkg} |\n`
    }
    return table
  }
}
