import { describe, expect, test, afterEach, beforeEach } from 'bun:test'
import { MakeProviderCommand } from '../../../src/commands/MakeProviderCommand.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../../.tmp_provider`

describe('MakeProviderCommand', () => {
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

  test('creates provider file at app/Providers', async () => {
    const cmd = new MakeProviderCommand()
    const code = await cmd.handle({ command: 'make:provider', args: ['App'], flags: {} })
    expect(code).toBe(0)
    const file = `${TMP}/app/Providers/AppServiceProvider.ts`
    expect(existsSync(file)).toBe(true)
  })

  test('generated class extends ServiceProvider with override keywords', async () => {
    const cmd = new MakeProviderCommand()
    await cmd.handle({ command: 'make:provider', args: ['App'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Providers/AppServiceProvider.ts`).text()
    expect(content).toContain('export class AppServiceProvider extends ServiceProvider')
    expect(content).toContain('override register()')
    expect(content).toContain('override async boot()')
  })

  test('imports from @mantiq/core', async () => {
    const cmd = new MakeProviderCommand()
    await cmd.handle({ command: 'make:provider', args: ['Event'], flags: {} })
    const content = await Bun.file(`${TMP}/app/Providers/EventServiceProvider.ts`).text()
    expect(content).toContain("import { ServiceProvider } from '@mantiq/core'")
  })

  test('refuses to overwrite existing file', async () => {
    const cmd = new MakeProviderCommand()
    await cmd.handle({ command: 'make:provider', args: ['Dupe'], flags: {} })
    const code = await cmd.handle({ command: 'make:provider', args: ['Dupe'], flags: {} })
    expect(code).toBe(1)
  })

  test('strips ServiceProvider suffix if already present', async () => {
    const cmd = new MakeProviderCommand()
    const code = await cmd.handle({ command: 'make:provider', args: ['AppServiceProvider'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Providers/AppServiceProvider.ts`)).toBe(true)
  })

  test('converts kebab-case input to PascalCase', async () => {
    const cmd = new MakeProviderCommand()
    const code = await cmd.handle({ command: 'make:provider', args: ['event-bus'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Providers/EventBusServiceProvider.ts`)).toBe(true)
  })

  test('converts snake_case input to PascalCase', async () => {
    const cmd = new MakeProviderCommand()
    const code = await cmd.handle({ command: 'make:provider', args: ['event_bus'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/app/Providers/EventBusServiceProvider.ts`)).toBe(true)
  })
})
