import { describe, test, expect, mock } from 'bun:test'
import { AppCheck } from '../../../src/checks/AppCheck.ts'

describe('AppCheck', () => {
  test('passes when APP_KEY is set and app is valid', async () => {
    const origKey = process.env['APP_KEY']
    process.env['APP_KEY'] = 'base64:abcdefghijklmnopqrstuvwxyz123456'
    try {
      const app = { config: mock(() => 'MyApp') }
      const result = await new AppCheck(app).execute()
      expect(result.status).toBe('ok')
      expect(result.name).toBe('app')
      expect(result.meta?.key).toBe('set')
      expect(result.meta?.name).toBe('MyApp')
    } finally {
      if (origKey) process.env['APP_KEY'] = origKey
      else delete process.env['APP_KEY']
    }
  })

  test('fails when APP_KEY is missing', async () => {
    const origKey = process.env['APP_KEY']
    delete process.env['APP_KEY']
    try {
      const result = await new AppCheck({}).execute()
      expect(result.status).toBe('critical')
      expect(result.message).toContain('APP_KEY')
      expect(result.message).toContain('missing or too short')
    } finally {
      if (origKey) process.env['APP_KEY'] = origKey
    }
  })

  test('fails when APP_KEY is too short', async () => {
    const origKey = process.env['APP_KEY']
    process.env['APP_KEY'] = 'short'
    try {
      const result = await new AppCheck({}).execute()
      expect(result.status).toBe('critical')
      expect(result.message).toContain('APP_KEY')
    } finally {
      if (origKey) process.env['APP_KEY'] = origKey
      else delete process.env['APP_KEY']
    }
  })

  test('fails when app instance is null', async () => {
    const result = await new AppCheck(null).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('Application instance is null')
  })

  test('reports debug mode in metadata', async () => {
    const origKey = process.env['APP_KEY']
    const origDebug = process.env['APP_DEBUG']
    process.env['APP_KEY'] = 'base64:abcdefghijklmnopqrstuvwxyz123456'
    process.env['APP_DEBUG'] = 'true'
    try {
      const result = await new AppCheck({}).execute()
      expect(result.status).toBe('ok')
      expect(result.meta?.debug).toBe(true)
    } finally {
      if (origKey) process.env['APP_KEY'] = origKey; else delete process.env['APP_KEY']
      if (origDebug) process.env['APP_DEBUG'] = origDebug; else delete process.env['APP_DEBUG']
    }
  })

  test('reports environment in metadata', async () => {
    const origKey = process.env['APP_KEY']
    const origEnv = process.env['APP_ENV']
    process.env['APP_KEY'] = 'base64:abcdefghijklmnopqrstuvwxyz123456'
    process.env['APP_ENV'] = 'production'
    try {
      const result = await new AppCheck({}).execute()
      expect(result.meta?.env).toBe('production')
    } finally {
      if (origKey) process.env['APP_KEY'] = origKey; else delete process.env['APP_KEY']
      if (origEnv) process.env['APP_ENV'] = origEnv; else delete process.env['APP_ENV']
    }
  })

  test('degrades when config is not accessible', async () => {
    const origKey = process.env['APP_KEY']
    process.env['APP_KEY'] = 'base64:abcdefghijklmnopqrstuvwxyz123456'
    try {
      const app = {
        config: () => { throw new Error('Config not booted') },
        make: () => { throw new Error('Container not ready') },
      }
      const result = await new AppCheck(app).execute()
      expect(result.status).toBe('degraded')
      expect(result.message).toContain('Config not accessible')
    } finally {
      if (origKey) process.env['APP_KEY'] = origKey; else delete process.env['APP_KEY']
    }
  })

  test('resolves name via make() fallback', async () => {
    const origKey = process.env['APP_KEY']
    process.env['APP_KEY'] = 'base64:abcdefghijklmnopqrstuvwxyz123456'
    try {
      const app = {
        make: mock(() => ({ get: () => 'FallbackApp' })),
      }
      const result = await new AppCheck(app).execute()
      expect(result.status).toBe('ok')
      expect(result.meta?.name).toBe('FallbackApp')
    } finally {
      if (origKey) process.env['APP_KEY'] = origKey; else delete process.env['APP_KEY']
    }
  })
})
