import { describe, it, expect, beforeEach } from 'bun:test'
import { ContextualLogger } from '../../src/ContextualLogger.ts'
import { LogFake } from '../../src/testing/LogFake.ts'

describe('ContextualLogger', () => {
  let fake: LogFake

  beforeEach(() => {
    fake = new LogFake()
  })

  it('merges context into every log call', () => {
    const logger = new ContextualLogger(fake, { requestId: 'abc123' })

    logger.info('Processing request')

    const logged = fake.all()
    expect(logged).toHaveLength(1)
    expect(logged[0]!.message).toBe('Processing request')
    expect(logged[0]!.context).toEqual({ requestId: 'abc123' })
  })

  it('merges call-site context on top of persistent context', () => {
    const logger = new ContextualLogger(fake, { requestId: 'abc123' })

    logger.info('Done', { duration: 42 })

    const logged = fake.all()
    expect(logged[0]!.context).toEqual({ requestId: 'abc123', duration: 42 })
  })

  it('call-site context overrides persistent context for same key', () => {
    const logger = new ContextualLogger(fake, { requestId: 'abc123', status: 200 })

    logger.error('Retried', { status: 500 })

    const logged = fake.all()
    expect(logged[0]!.context.status).toBe(500)
    expect(logged[0]!.context.requestId).toBe('abc123')
  })

  it('supports chaining withContext to add more context', () => {
    const logger = new ContextualLogger(fake, { requestId: 'abc123' })
    const child = logger.withContext({ userId: 42 })

    child.info('User action')

    const logged = fake.all()
    expect(logged[0]!.context).toEqual({ requestId: 'abc123', userId: 42 })
  })

  it('does not mutate parent context when chaining', () => {
    const logger = new ContextualLogger(fake, { requestId: 'abc123' })
    const child = logger.withContext({ userId: 42 })

    logger.info('Parent log')
    child.info('Child log')

    const logged = fake.all()
    expect(logged[0]!.context).toEqual({ requestId: 'abc123' })
    expect(logged[1]!.context).toEqual({ requestId: 'abc123', userId: 42 })
  })

  it('delegates all log level methods correctly', () => {
    const logger = new ContextualLogger(fake, { scope: 'test' })

    logger.emergency('e')
    logger.alert('a')
    logger.critical('c')
    logger.error('err')
    logger.warning('w')
    logger.notice('n')
    logger.info('i')
    logger.debug('d')

    fake.assertLoggedCount(8)
    fake.assertLogged('emergency', 'e')
    fake.assertLogged('alert', 'a')
    fake.assertLogged('critical', 'c')
    fake.assertLogged('error', 'err')
    fake.assertLogged('warning', 'w')
    fake.assertLogged('notice', 'n')
    fake.assertLogged('info', 'i')
    fake.assertLogged('debug', 'd')

    // All entries carry the context
    for (const entry of fake.all()) {
      expect(entry.context).toEqual({ scope: 'test' })
    }
  })
})
