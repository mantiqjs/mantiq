import type { RuleSection } from '../RuleRegistry.ts'
import type { DetectedPackage } from '../PackageDetector.ts'

export class BaseClassSection implements RuleSection {
  readonly id = 'base-classes'
  readonly title = 'Base Class Signatures'
  readonly requires: string[] = []

  render(packages: DetectedPackage[]): string {
    const installed = new Set(packages.filter((p) => p.installed).map((p) => p.name))

    let out = `CRITICAL: All overrides MUST use the \`override\` keyword (\`noImplicitOverride\` is enabled).`

    if (installed.has('database')) {
      out += `

### Model (\`@mantiq/database\`)
\`\`\`typescript
class Post extends Model {
  static override table = 'posts'
  static override fillable = ['title', 'body']
  static override hidden = ['secret']
  static override casts = { published: 'boolean', metadata: 'json' }
  static override timestamps = true
  static override softDelete = false
}
\`\`\`

### Migration (\`@mantiq/database\`)
\`\`\`typescript
export default class CreatePostsTable extends Migration {
  override async up(schema: SchemaBuilder): Promise<void> { }
  override async down(schema: SchemaBuilder): Promise<void> { }
}
\`\`\`

### Factory (\`@mantiq/database\`)
\`\`\`typescript
export class PostFactory extends Factory<Post> {
  protected override model = Post
  // NOTE: signature is (index, fake) — NOT (faker)
  override definition(index: number, fake: Faker): Record<string, any> {
    return { title: fake.sentence(), body: fake.paragraph() }
  }
}
\`\`\`

### Seeder (\`@mantiq/database\`)
\`\`\`typescript
export default class DatabaseSeeder extends Seeder {
  override async run(): Promise<void> { }
}
\`\`\``
    }

    out += `

### Controller (plain class — no base class)
\`\`\`typescript
export class PostController {
  async index(request: MantiqRequest): Promise<Response> {
    return MantiqResponse.json({ data: [] })
  }
  async store(request: MantiqRequest): Promise<Response> { }
  async show(request: MantiqRequest): Promise<Response> { }
  async update(request: MantiqRequest): Promise<Response> { }
  async destroy(request: MantiqRequest): Promise<Response> { }
}
\`\`\`

### Middleware (\`@mantiq/core\`)
\`\`\`typescript
export class RateLimitMiddleware implements Middleware {
  // NOTE: next() takes NO arguments
  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    return next()
  }
}
\`\`\`

### ServiceProvider (\`@mantiq/core\`)
\`\`\`typescript
export class AppServiceProvider extends ServiceProvider {
  override register(): void { }
  override async boot(): Promise<void> { }
}
\`\`\``

    if (installed.has('validation')) {
      out += `

### FormRequest (\`@mantiq/validation\`)
\`\`\`typescript
export class StorePostRequest extends FormRequest {
  override authorize(): boolean { return true }
  override rules(): Record<string, string> {
    return { title: 'required|string|max:255', body: 'required' }
  }
}
\`\`\``
    }

    out += `

### Command (\`@mantiq/cli\`)
\`\`\`typescript
export class SendEmailsCommand extends Command {
  override name = 'app:send-emails'
  override description = 'Send pending emails'
  override async handle(args: ParsedArgs): Promise<number> {
    return 0 // 0 = success
  }
}
\`\`\``

    if (installed.has('queue')) {
      out += `

### Job (\`@mantiq/queue\`)
\`\`\`typescript
export class ProcessPayment extends Job {
  override tries = 3
  override backoff = 10
  constructor(public data: Record<string, any> = {}) { super() }
  override async handle(): Promise<void> { }
  override async failed(error: Error): Promise<void> { }
}
\`\`\``
    }

    if (installed.has('mail')) {
      out += `

### Mailable (\`@mantiq/mail\`)
\`\`\`typescript
export class WelcomeMail extends Mailable {
  override build(): void {
    this.setSubject('Welcome')
    this.html('<h1>Welcome</h1>')
  }
}
\`\`\``
    }

    if (installed.has('notify')) {
      out += `

### Notification (\`@mantiq/notify\`)
\`\`\`typescript
export class InvoicePaid extends Notification {
  override via(notifiable: Notifiable): string[] { return ['mail', 'database'] }
  override toMail(notifiable: Notifiable): any { }
  override toDatabase(notifiable: Notifiable): Record<string, any> { return {} }
}
\`\`\``
    }

    if (installed.has('auth')) {
      out += `

### Policy (\`@mantiq/auth\`)
\`\`\`typescript
export class PostPolicy extends Policy {
  view(user: any, post: Post): boolean { return true }
  create(user: any): boolean { return true }
  update(user: any, post: Post): boolean { return user.id === post.user_id }
  delete(user: any, post: Post): boolean { return user.id === post.user_id }
}
\`\`\``
    }

    return out
  }
}
