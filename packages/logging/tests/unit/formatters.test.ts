import { describe, it, expect } from 'bun:test'
import { LineFormatter } from '../../src/formatters/LineFormatter.ts'
import { JsonFormatter } from '../../src/formatters/JsonFormatter.ts'
import type { LogEntry } from '../../src/contracts/Logger.ts'

const entry: LogEntry = {
  level: 'info',
  message: 'User logged in',
  context: { userId: 42 },
  timestamp: new Date('2024-06-15T10:30:00.000Z'),
  channel: 'app',
}

const entryNoCtx: LogEntry = {
  level: 'error',
  message: 'Server crashed',
  context: {},
  timestamp: new Date('2024-06-15T10:30:00.000Z'),
  channel: 'system',
}

describe('LineFormatter', () => {
  const fmt = new LineFormatter()

  it('formats a log entry with context', () => {
    const line = fmt.format(entry)
    expect(line).toBe('[2024-06-15T10:30:00.000Z] app.INFO      User logged in {"userId":42}')
  })

  it('formats a log entry without context', () => {
    const line = fmt.format(entryNoCtx)
    expect(line).toBe('[2024-06-15T10:30:00.000Z] system.ERROR     Server crashed')
  })

  it('pads log level to 9 characters', () => {
    const debug: LogEntry = { ...entry, level: 'debug' }
    const line = fmt.format(debug)
    expect(line).toContain('DEBUG    ')

    const emergency: LogEntry = { ...entry, level: 'emergency' }
    const eLine = fmt.format(emergency)
    expect(eLine).toContain('EMERGENCY')
  })
})

describe('JsonFormatter', () => {
  const fmt = new JsonFormatter()

  it('formats a log entry as JSON', () => {
    const line = fmt.format(entry)
    const parsed = JSON.parse(line)
    expect(parsed.timestamp).toBe('2024-06-15T10:30:00.000Z')
    expect(parsed.channel).toBe('app')
    expect(parsed.level).toBe('info')
    expect(parsed.message).toBe('User logged in')
    expect(parsed.context).toEqual({ userId: 42 })
  })

  it('omits context when empty', () => {
    const line = fmt.format(entryNoCtx)
    const parsed = JSON.parse(line)
    expect(parsed.context).toBeUndefined()
    expect(parsed.level).toBe('error')
    expect(parsed.message).toBe('Server crashed')
  })
})
