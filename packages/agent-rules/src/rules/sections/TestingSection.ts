import type { RuleSection } from '../RuleRegistry.ts'
import type { DetectedPackage } from '../PackageDetector.ts'

export class TestingSection implements RuleSection {
  readonly id = 'testing'
  readonly title = 'Testing'
  readonly requires = ['testing']

  render(_packages: DetectedPackage[]): string {
    return `Test runner: \`bun test\` (uses \`bun:test\`, NOT jest/vitest)

\`\`\`typescript
import { describe, test, expect } from 'bun:test'
import { TestCase } from '@mantiq/testing'

const t = new TestCase()
t.refreshDatabase = true
t.setup()

describe('Posts', () => {
  test('can list posts', async () => {
    await t.client.initSession()
    const res = await t.client.get('/api/posts')
    res.assertOk()
    await res.assertJsonHasKey('data')
  })

  test('can create a post', async () => {
    await t.client.initSession()
    const res = await t.client.post('/api/posts', { title: 'Hello', body: 'World' })
    res.assertCreated()
    await t.assertDatabaseHas('posts', { title: 'Hello' })
  })
})
\`\`\`

Key patterns:
- Feature tests: \`tests/feature/\`, unit tests: \`tests/unit/\`
- \`TestClient\` handles cookies and CSRF automatically
- Call \`t.client.initSession()\` before POST/PUT/DELETE to get CSRF token
- Database assertions: \`assertDatabaseHas\`, \`assertDatabaseMissing\`, \`assertDatabaseCount\`
- Response assertions: \`assertOk()\`, \`assertCreated()\`, \`assertStatus(n)\`, \`assertJsonPath()\`
- Run: \`bun test tests/\` or \`bun test tests/feature/auth.test.ts\``
  }
}
