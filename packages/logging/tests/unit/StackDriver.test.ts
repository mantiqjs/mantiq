import { describe, it, expect } from 'bun:test'
import { StackDriver } from '../../src/drivers/StackDriver.ts'
import { LogFake } from '../../src/testing/LogFake.ts'

describe('StackDriver', () => {
  it('writes to all underlying drivers', () => {
    const a = new LogFake()
    const b = new LogFake()
    const stack = new StackDriver([a, b])

    stack.info('hello')
    stack.error('oops', { code: 42 })

    a.assertLogged('info', 'hello')
    a.assertLogged('error', 'oops')
    b.assertLogged('info', 'hello')
    b.assertLogged('error', 'oops')
  })

  it('delegates all log levels', () => {
    const fake = new LogFake()
    const stack = new StackDriver([fake])

    stack.emergency('e')
    stack.alert('a')
    stack.critical('c')
    stack.error('err')
    stack.warning('w')
    stack.notice('n')
    stack.info('i')
    stack.debug('d')

    fake.assertLoggedCount(8)
  })
})
