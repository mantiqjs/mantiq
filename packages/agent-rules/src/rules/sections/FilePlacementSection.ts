import type { RuleSection } from '../RuleRegistry.ts'
import type { DetectedPackage } from '../PackageDetector.ts'

export class FilePlacementSection implements RuleSection {
  readonly id = 'file-placement'
  readonly title = 'File Placement Conventions'
  readonly requires: string[] = []

  render(_packages: DetectedPackage[]): string {
    return `| What | Directory | Naming | Example |
|---|---|---|---|
| Controllers | \`app/Http/Controllers/\` | \`<Name>Controller.ts\` | \`PostController.ts\` |
| Models | \`app/Models/\` | \`<Name>.ts\` | \`Post.ts\` |
| Middleware | \`app/Http/Middleware/\` | \`<Name>Middleware.ts\` | \`RateLimitMiddleware.ts\` |
| Form Requests | \`app/Http/Requests/\` | \`<Action><Name>Request.ts\` | \`StorePostRequest.ts\` |
| Providers | \`app/Providers/\` | \`<Name>ServiceProvider.ts\` | \`AppServiceProvider.ts\` |
| Commands | \`app/Console/Commands/\` | \`<Name>Command.ts\` | \`SendEmailsCommand.ts\` |
| Events | \`app/Events/\` | \`<Name>.ts\` | \`OrderPlaced.ts\` |
| Listeners | \`app/Listeners/\` | \`<Name>.ts\` | \`SendNotification.ts\` |
| Jobs | \`app/Jobs/\` | \`<Name>.ts\` | \`ProcessPayment.ts\` |
| Mail | \`app/Mail/\` | \`<Name>.ts\` | \`WelcomeMail.ts\` |
| Notifications | \`app/Notifications/\` | \`<Name>.ts\` | \`InvoicePaid.ts\` |
| Policies | \`app/Policies/\` | \`<Name>Policy.ts\` | \`PostPolicy.ts\` |
| Observers | \`app/Observers/\` | \`<Name>Observer.ts\` | \`PostObserver.ts\` |
| Exceptions | \`app/Exceptions/\` | \`<Name>Exception.ts\` | \`PaymentException.ts\` |
| Rules | \`app/Rules/\` | \`<Name>Rule.ts\` | \`UppercaseRule.ts\` |
| Enums | \`app/Enums/\` | \`<Name>.ts\` | \`UserStatus.ts\` |
| Migrations | \`database/migrations/\` | \`YYYYMMDD_<name>.ts\` | \`20240101_create_posts_table.ts\` |
| Seeders | \`database/seeders/\` | \`<Name>Seeder.ts\` | \`PostSeeder.ts\` |
| Factories | \`database/factories/\` | \`<Name>Factory.ts\` | \`PostFactory.ts\` |
| Config | \`config/\` | \`<name>.ts\` | \`database.ts\` |
| Routes | \`routes/\` | \`<name>.ts\` | \`web.ts\`, \`api.ts\` |
| Feature tests | \`tests/feature/\` | \`<name>.test.ts\` | \`auth.test.ts\` |
| Unit tests | \`tests/unit/\` | \`<name>.test.ts\` | \`example.test.ts\` |`
  }
}
