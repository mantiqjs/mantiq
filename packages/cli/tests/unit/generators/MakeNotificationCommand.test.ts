import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakeNotificationCommand } from '../../../src/commands/MakeNotificationCommand.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../../.tmp_notification`

describe('MakeNotificationCommand', () => {
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

  test('creates notification file at app/Notifications', async () => {
    const cmd = new MakeNotificationCommand()
    const code = await cmd.handle({ command: 'make:notification', args: ['InvoicePaid'], flags: {} })
    expect(code).toBe(0)
    const file = `${TMP}/app/Notifications/InvoicePaid.ts`
    expect(existsSync(file)).toBe(true)
  })

  test('generated class extends Notification with override keywords', async () => {
    const cmd = new MakeNotificationCommand()
    await cmd.handle({ command: 'make:notification', args: ['InvoicePaid'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Notifications/InvoicePaid.ts`).text()
    expect(content).toContain('export class InvoicePaid extends Notification')
    expect(content).toContain('override via')
    expect(content).toContain('override toMail')
    expect(content).toContain('override toDatabase')
  })

  test('imports from @mantiq/notify', async () => {
    const cmd = new MakeNotificationCommand()
    await cmd.handle({ command: 'make:notification', args: ['InvoicePaid'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Notifications/InvoicePaid.ts`).text()
    expect(content).toContain("import { Notification } from '@mantiq/notify'")
    expect(content).toContain("import type { Notifiable } from '@mantiq/notify'")
  })

  test('generates human-readable subject in toMail', async () => {
    const cmd = new MakeNotificationCommand()
    await cmd.handle({ command: 'make:notification', args: ['OrderShipped'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Notifications/OrderShipped.ts`).text()
    expect(content).toContain('Order Shipped')
  })

  test('generates snake_case type in toDatabase', async () => {
    const cmd = new MakeNotificationCommand()
    await cmd.handle({ command: 'make:notification', args: ['InvoicePaid'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Notifications/InvoicePaid.ts`).text()
    expect(content).toContain("type: 'invoice_paid'")
  })

  test('defaults to mail and database channels', async () => {
    const cmd = new MakeNotificationCommand()
    await cmd.handle({ command: 'make:notification', args: ['Welcome'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Notifications/Welcome.ts`).text()
    expect(content).toContain("return ['mail', 'database']")
  })

  test('refuses to overwrite existing file', async () => {
    const cmd = new MakeNotificationCommand()
    await cmd.handle({ command: 'make:notification', args: ['Dupe'], flags: {} })
    const code = await cmd.handle({ command: 'make:notification', args: ['Dupe'], flags: {} })
    expect(code).toBe(1)
  })

  test('converts kebab-case input to PascalCase', async () => {
    const cmd = new MakeNotificationCommand()
    const code = await cmd.handle({ command: 'make:notification', args: ['invoice-paid'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Notifications/InvoicePaid.ts`)).toBe(true)
  })
})
