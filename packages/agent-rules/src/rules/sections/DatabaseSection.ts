import type { RuleSection } from '../RuleRegistry.ts'
import type { DetectedPackage } from '../PackageDetector.ts'

export class DatabaseSection implements RuleSection {
  readonly id = 'database'
  readonly title = 'Database & ORM (@mantiq/database)'
  readonly requires = ['database']

  render(_packages: DetectedPackage[]): string {
    return `### Queries
\`\`\`typescript
const users = await User.all()
const user = await User.find(1)
const user = await User.where('email', 'test@example.com').first()
const count = await User.count()
const page = await User.paginate(1, 15)
const posts = await Post.with('author', 'comments').get()
\`\`\`

### Model Features
- \`fillable\` — mass-assignable fields (whitelist)
- \`hidden\` — fields excluded from serialization
- \`casts\` — auto type conversion: \`'int'\`, \`'boolean'\`, \`'json'\`, \`'datetime'\`
- \`timestamps\` — auto \`created_at\` / \`updated_at\`
- \`softDelete\` — soft delete with \`deleted_at\` column
- Scopes: \`static override scopes = { active: (q) => q.where('status', 'active') }\`

### Schema Builder (migrations)
\`\`\`typescript
await schema.create('posts', (t) => {
  t.id()                          // auto-increment primary key
  t.string('title')
  t.text('body')
  t.integer('user_id').unsigned()
  t.boolean('published').default(false)
  t.timestamps()                  // created_at + updated_at
  t.softDeletes()                 // deleted_at
})
\`\`\`

### Validation Rule Strings
\`\`\`
'required|string|max:255'
'required|email|unique:users,email'
'integer|min:0|max:100'
'required|min:8|confirmed'
\`\`\``
  }
}
