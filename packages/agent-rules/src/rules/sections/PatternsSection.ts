import type { RuleSection } from '../RuleRegistry.ts'
import type { DetectedPackage } from '../PackageDetector.ts'

export class PatternsSection implements RuleSection {
  readonly id = 'patterns'
  readonly title = 'Common Patterns'
  readonly requires: string[] = []

  render(_packages: DetectedPackage[]): string {
    return `### Routing
Route files export a default function receiving a \`Router\`:
\`\`\`typescript
import type { Router } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'

export default function (router: Router) {
  router.get('/posts', [PostController, 'index'])
  router.post('/posts', [PostController, 'store'])
  router.get('/posts/:id', [PostController, 'show']).whereNumber('id')

  router.group({ prefix: '/admin', middleware: ['auth'] }, (r) => {
    r.resource('/users', UserController)
  })
}
\`\`\`

### Responses
\`\`\`typescript
return MantiqResponse.json({ data: users })         // 200 JSON
return MantiqResponse.json({ data: post }, 201)      // 201 Created
return MantiqResponse.noContent()                     // 204
return MantiqResponse.redirect('/login')              // 302
return MantiqResponse.html('<h1>Hello</h1>')          // HTML
\`\`\`

### Config Files
ESM modules in \`config/\` exporting default objects using \`env()\`:
\`\`\`typescript
import { env } from '@mantiq/core'

export default {
  name: env('APP_NAME', 'MantiqJS'),
  debug: env('APP_DEBUG', false),
}
\`\`\`

### Service Container (IoC)
Use class keys, NOT strings:
\`\`\`typescript
// CORRECT:
app.singleton(CacheManager, () => new CacheManager())
const cache = app.make(CacheManager)

// WRONG — will throw:
app.make('cache')
\`\`\`

### Bootstrap Entry Point (\`index.ts\`)
- Uses \`Application.create()\`, \`Discoverer\` for auto-discovery
- Guard server startup with \`if (import.meta.main) { ... }\`
- Export \`app\` as default for CLI and testing compatibility`
  }
}
