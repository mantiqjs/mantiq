import { describe, test } from 'bun:test'
import { TestCase } from '@mantiq/testing'

const t = new TestCase()
t.setup()

describe('Home', () => {
  test('GET / returns 200', async () => {
    const res = await t.client.get('/')
    res.assertOk()
  })

  test('GET / returns HTML', async () => {
    const res = await t.client.get('/')
    res.assertHeader('content-type')
  })
})
