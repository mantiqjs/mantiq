import { describe, test, expect, mock } from 'bun:test'
import { MailCheck } from '../../../src/checks/MailCheck.ts'

describe('MailCheck', () => {
  test('passes with configured SMTP transport', async () => {
    const mockMail = {
      getDefaultDriver: () => 'smtp',
      driver: () => ({ send: mock() }),
    }
    const result = await new MailCheck(mockMail).execute()
    expect(result.status).toBe('ok')
    expect(result.name).toBe('mail')
    expect(result.meta?.driver).toBe('smtp')
  })

  test('passes with SES driver', async () => {
    const mockMail = {
      getDefaultDriver: () => 'ses',
      driver: () => ({ send: mock() }),
    }
    const result = await new MailCheck(mockMail).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.driver).toBe('ses')
  })

  test('fails when mail instance is null', async () => {
    const result = await new MailCheck(null).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toBe('Mail instance is null')
  })

  test('degrades when transport cannot be resolved', async () => {
    const mockMail = {
      getDefaultDriver: () => 'smtp',
      driver: () => null,
    }
    const result = await new MailCheck(mockMail).execute()
    expect(result.status).toBe('degraded')
    expect(result.message).toContain('transport could not be resolved')
  })

  test('fails when driver() throws (transport unreachable)', async () => {
    const mockMail = {
      getDefaultDriver: () => 'smtp',
      driver: () => { throw new Error('SMTP transport connection failed') },
    }
    const result = await new MailCheck(mockMail).execute()
    expect(result.status).toBe('critical')
    expect(result.message).toContain('Mail driver not configured')
    expect(result.message).toContain('SMTP transport connection failed')
  })

  test('falls back to transport() when driver() is missing', async () => {
    const mockMail = {
      getDefaultDriver: () => 'postmark',
      transport: () => ({ send: mock() }),
    }
    const result = await new MailCheck(mockMail).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.driver).toBe('postmark')
  })

  test('degrades when neither driver() nor transport() exist', async () => {
    const mockMail = {
      getDefaultDriver: () => 'log',
    }
    const result = await new MailCheck(mockMail).execute()
    expect(result.status).toBe('degraded')
    expect(result.message).toContain('transport could not be resolved')
  })

  test('falls back to "unknown" when getDefaultDriver is missing', async () => {
    const mockMail = {
      driver: () => ({ send: mock() }),
    }
    const result = await new MailCheck(mockMail).execute()
    expect(result.status).toBe('ok')
    expect(result.meta?.driver).toBe('unknown')
  })
})
