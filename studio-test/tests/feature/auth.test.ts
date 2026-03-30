import { describe, test, beforeAll } from 'bun:test'
import { TestCase } from '@mantiq/testing'

const t = new TestCase()
t.refreshDatabase = true
t.setup()

const user = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'password123',
}

describe('Authentication', () => {
  test('can register a new user', async () => {
    await t.client.initSession()
    const res = await t.client.post('/register', user)
    res.assertCreated()
    await res.assertJson({ message: 'Registered.' })
    await res.assertJsonMissingKey('password')
    await t.assertDatabaseHas('users', { email: user.email })
  })

  test('cannot register with duplicate email', async () => {
    await t.client.initSession()
    await t.client.post('/register', user)
    const res = await t.client.post('/register', user)
    res.assertUnprocessable()
  })

  test('can login with valid credentials', async () => {
    await t.client.initSession()
    await t.client.post('/register', user)
    t.client.flushCookies()

    await t.client.initSession()
    const res = await t.client.post('/login', {
      email: user.email,
      password: user.password,
    })
    res.assertOk()
    await res.assertJson({ message: 'Logged in.' })
  })

  test('cannot login with wrong password', async () => {
    await t.client.initSession()
    await t.client.post('/register', user)
    t.client.flushCookies()

    await t.client.initSession()
    const res = await t.client.post('/login', {
      email: user.email,
      password: 'wrong',
    })
    res.assertUnauthorized()
  })

  test('can logout', async () => {
    await t.client.initSession()
    await t.client.post('/register', user)
    const logoutRes = await t.client.post('/logout')
    logoutRes.assertOk()
  })

  test('protected routes require authentication', async () => {
    const res = await t.client.get('/api/users')
    res.assertUnauthorized()
  })
})
