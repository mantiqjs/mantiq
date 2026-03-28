import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakeEventCommand } from '../../../src/commands/MakeEventCommand.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../../.tmp_event`

describe('MakeEventCommand', () => {
  let origCwd: typeof process.cwd

  beforeEach(() => {
    origCwd = process.cwd
    process.cwd = () => TMP
    mkdirSync(TMP, { recursive: true })
  })

  afterEach(() => {
    process.cwd = origCwd
    if (existsSync(TMP)) rmSync(TMP, { recursive: true })
  })

  test('creates event file at app/Events', async () => {
    const cmd = new MakeEventCommand()
    const code = await cmd.handle({ command: 'make:event', args: ['OrderShipped'], flags: {} })
    expect(code).toBe(0)
    const file = `${TMP}/app/Events/OrderShipped.ts`
    expect(existsSync(file)).toBe(true)
  })

  test('generated class has correct name (no suffix)', async () => {
    const cmd = new MakeEventCommand()
    await cmd.handle({ command: 'make:event', args: ['OrderShipped'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Events/OrderShipped.ts`).text()
    expect(content).toContain('export class OrderShipped')
  })

  test('generated class has broadcastOn and broadcastAs methods', async () => {
    const cmd = new MakeEventCommand()
    await cmd.handle({ command: 'make:event', args: ['OrderShipped'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Events/OrderShipped.ts`).text()
    expect(content).toContain('broadcastOn(): string[]')
    expect(content).toContain('broadcastAs(): string')
    expect(content).toContain("return 'OrderShipped'")
  })

  test('generated class has data constructor parameter', async () => {
    const cmd = new MakeEventCommand()
    await cmd.handle({ command: 'make:event', args: ['UserRegistered'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Events/UserRegistered.ts`).text()
    expect(content).toContain('public readonly data: Record<string, unknown>')
  })

  test('refuses to overwrite existing file', async () => {
    const cmd = new MakeEventCommand()
    await cmd.handle({ command: 'make:event', args: ['Dupe'], flags: {} })
    const code = await cmd.handle({ command: 'make:event', args: ['Dupe'], flags: {} })
    expect(code).toBe(1)
  })

  test('converts kebab-case input to PascalCase', async () => {
    const cmd = new MakeEventCommand()
    const code = await cmd.handle({ command: 'make:event', args: ['order-shipped'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Events/OrderShipped.ts`)).toBe(true)
  })

  test('converts snake_case input to PascalCase', async () => {
    const cmd = new MakeEventCommand()
    const code = await cmd.handle({ command: 'make:event', args: ['order_shipped'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Events/OrderShipped.ts`)).toBe(true)
  })
})
