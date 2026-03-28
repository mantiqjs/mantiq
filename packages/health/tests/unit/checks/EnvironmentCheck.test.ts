import { describe, test, expect } from 'bun:test'
import { EnvironmentCheck } from '../../../src/checks/EnvironmentCheck.ts'

describe('EnvironmentCheck', () => {
  test('passes when all required vars are set', async () => {
    process.env['HEALTH_ENV_A'] = 'value_a'
    process.env['HEALTH_ENV_B'] = 'value_b'
    try {
      const result = await new EnvironmentCheck(['HEALTH_ENV_A', 'HEALTH_ENV_B']).execute()
      expect(result.status).toBe('ok')
      expect(result.name).toBe('environment')
      expect(result.meta?.checked).toBe(2)
      expect(result.meta?.present).toBe(2)
    } finally {
      delete process.env['HEALTH_ENV_A']
      delete process.env['HEALTH_ENV_B']
    }
  })

  test('fails when a required var is missing', async () => {
    delete process.env['DEFINITELY_NOT_SET_12345']
    const result = await new EnvironmentCheck(['DEFINITELY_NOT_SET_12345']).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('DEFINITELY_NOT_SET_12345')
    expect(result.message).toContain('Missing environment variables')
  })

  test('reports all missing vars in error message', async () => {
    const result = await new EnvironmentCheck(['MISSING_A_9999', 'MISSING_B_9999']).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('MISSING_A_9999')
    expect(result.message).toContain('MISSING_B_9999')
  })

  test('fails only for the missing vars, not the present ones', async () => {
    process.env['HEALTH_ENV_PRESENT'] = 'yes'
    try {
      const result = await new EnvironmentCheck(['HEALTH_ENV_PRESENT', 'HEALTH_ENV_ABSENT_9999']).execute()
      expect(result.status).toBe('critical')
      expect(result.message).toContain('HEALTH_ENV_ABSENT_9999')
      expect(result.message).not.toContain('HEALTH_ENV_PRESENT')
      expect(result.meta?.missing).toEqual(['HEALTH_ENV_ABSENT_9999'])
    } finally {
      delete process.env['HEALTH_ENV_PRESENT']
    }
  })

  test('defaults to checking APP_KEY when no vars specified', async () => {
    const origKey = process.env['APP_KEY']
    delete process.env['APP_KEY']
    try {
      const result = await new EnvironmentCheck().execute()
      expect(result.status).toBe('critical')
      expect(result.message).toContain('APP_KEY')
    } finally {
      if (origKey) process.env['APP_KEY'] = origKey
    }
  })

  test('passes with empty vars array', async () => {
    const result = await new EnvironmentCheck([]).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.checked).toBe(0)
  })

  test('treats empty string as missing', async () => {
    process.env['HEALTH_EMPTY_VAR'] = ''
    try {
      const result = await new EnvironmentCheck(['HEALTH_EMPTY_VAR']).execute()
      // process.env returns '' which is falsy, so it should be treated as missing
      expect(result.status).toBe('critical')
      expect(result.message).toContain('HEALTH_EMPTY_VAR')
    } finally {
      delete process.env['HEALTH_EMPTY_VAR']
    }
  })
})
