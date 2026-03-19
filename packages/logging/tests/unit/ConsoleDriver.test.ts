import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { ConsoleDriver } from '../../src/drivers/ConsoleDriver.ts'

describe('ConsoleDriver', () => {
  let stdoutWrites: string[]
  let stderrWrites: string[]
  let origStdout: typeof process.stdout.write
  let origStderr: typeof process.stderr.write

  beforeEach(() => {
    stdoutWrites = []
    stderrWrites = []
    origStdout = process.stdout.write
    origStderr = process.stderr.write
    process.stdout.write = ((data: any) => { stdoutWrites.push(data); return true }) as any
    process.stderr.write = ((data: any) => { stderrWrites.push(data); return true }) as any
  })

  afterEach(() => {
    process.stdout.write = origStdout
    process.stderr.write = origStderr
  })

  it('writes info to stdout', () => {
    const driver = new ConsoleDriver('test')
    driver.info('hello world')
    expect(stdoutWrites.length).toBe(1)
    expect(stdoutWrites[0]).toContain('hello world')
    expect(stdoutWrites[0]).toContain('INFO')
    expect(stdoutWrites[0]).toContain('test')
  })

  it('writes error to stderr', () => {
    const driver = new ConsoleDriver('app')
    driver.error('something broke')
    expect(stderrWrites.length).toBe(1)
    expect(stderrWrites[0]).toContain('something broke')
    expect(stderrWrites[0]).toContain('ERROR')
  })

  it('writes emergency/alert/critical to stderr', () => {
    const driver = new ConsoleDriver('app')
    driver.emergency('system down')
    driver.alert('alert!')
    driver.critical('critical failure')
    expect(stderrWrites.length).toBe(3)
  })

  it('writes warning/notice/debug to stdout', () => {
    const driver = new ConsoleDriver('app')
    driver.warning('be careful')
    driver.notice('fyi')
    driver.debug('trace info')
    expect(stdoutWrites.length).toBe(3)
  })

  it('respects minimum log level', () => {
    const driver = new ConsoleDriver('app', 'warning')
    driver.debug('ignored')
    driver.info('ignored')
    driver.notice('ignored')
    driver.warning('kept')
    driver.error('kept')
    expect(stdoutWrites.length).toBe(1) // warning
    expect(stderrWrites.length).toBe(1) // error
  })

  it('includes context in output', () => {
    const driver = new ConsoleDriver('app')
    driver.info('user login', { userId: 42, ip: '127.0.0.1' })
    expect(stdoutWrites[0]).toContain('"userId":42')
    expect(stdoutWrites[0]).toContain('"ip":"127.0.0.1"')
  })

  it('omits context when empty', () => {
    const driver = new ConsoleDriver('app')
    driver.info('simple message')
    // Should not have a trailing JSON object
    expect(stdoutWrites[0]).not.toContain('{}')
  })

  it('includes timestamp in ISO format', () => {
    const driver = new ConsoleDriver('app')
    driver.info('now')
    // Match ISO date pattern
    expect(stdoutWrites[0]).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})
