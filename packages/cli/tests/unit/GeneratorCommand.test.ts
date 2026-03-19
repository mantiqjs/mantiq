import { describe, expect, test, afterEach } from 'bun:test'
import { GeneratorCommand } from '../../src/commands/GeneratorCommand.ts'
import type { ParsedArgs } from '../../src/Parser.ts'
import { existsSync, rmSync, mkdirSync } from 'node:fs'

const TMP = `${import.meta.dir}/../.tmp`

class StubGenerator extends GeneratorCommand {
  name = 'make:stub'
  description = 'test'

  directory() { return `${TMP}` }
  suffix() { return 'Stub' }

  stub(name: string, _args: ParsedArgs): string {
    return `export class ${name}Stub {}\n`
  }

  // Override to use absolute path in tests
  override async handle(args: ParsedArgs): Promise<number> {
    const rawName = args.args[0]
    if (!rawName) {
      this.io.error('No name')
      return 1
    }
    const className = this.toClassName(rawName)
    const fileName = `${className}${this.suffix()}.ts`
    const filePath = `${this.directory()}/${fileName}`

    if (existsSync(filePath)) {
      this.io.error(`${fileName} already exists.`)
      return 1
    }

    mkdirSync(this.directory(), { recursive: true })
    const content = this.stub(className, args)
    await Bun.write(filePath, content)
    return 0
  }
}

describe('GeneratorCommand', () => {
  afterEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true })
  })

  test('generates a file with PascalCase name', async () => {
    const cmd = new StubGenerator()
    const code = await cmd.handle({ command: 'make:stub', args: ['foo_bar'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/FooBarStub.ts`)).toBe(true)

    const content = await Bun.file(`${TMP}/FooBarStub.ts`).text()
    expect(content).toContain('export class FooBarStub')
  })

  test('returns 1 when no name provided', async () => {
    const cmd = new StubGenerator()
    const code = await cmd.handle({ command: 'make:stub', args: [], flags: {} })
    expect(code).toBe(1)
  })

  test('returns 1 if file already exists', async () => {
    const cmd = new StubGenerator()
    await cmd.handle({ command: 'make:stub', args: ['Widget'], flags: {} })
    const code = await cmd.handle({ command: 'make:stub', args: ['Widget'], flags: {} })
    expect(code).toBe(1)
  })

  test('strips suffix if already present in name', async () => {
    const cmd = new StubGenerator()
    const code = await cmd.handle({ command: 'make:stub', args: ['WidgetStub'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/WidgetStub.ts`)).toBe(true)
  })

  test('converts kebab-case to PascalCase', async () => {
    const cmd = new StubGenerator()
    const code = await cmd.handle({ command: 'make:stub', args: ['my-widget'], flags: {} })
    expect(code).toBe(0)
    expect(existsSync(`${TMP}/MyWidgetStub.ts`)).toBe(true)
  })
})
