import { describe, test } from 'bun:test'
import { TestCase } from '@mantiq/testing'

const t = new TestCase()
t.setup()

describe('API', () => {
  test('GET /api/ping returns ok', async () => {
    const res = await t.client.get('/api/ping')
    res.assertOk()
    await res.assertJson({ status: 'ok' })
    await res.assertJsonHasKey('timestamp')
  })
})
