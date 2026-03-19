import { describe, it, expect } from 'bun:test'
import { NullDriver } from '../../src/drivers/NullDriver.ts'

describe('NullDriver', () => {
  it('accepts all log levels without error', () => {
    const driver = new NullDriver()
    expect(() => {
      driver.emergency('test')
      driver.alert('test')
      driver.critical('test')
      driver.error('test')
      driver.warning('test')
      driver.notice('test')
      driver.info('test')
      driver.debug('test')
      driver.log('info', 'test', { key: 'value' })
    }).not.toThrow()
  })
})
