import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export class MakeTestCommand extends Command {
  override name = 'make:test'
  override description = 'Create a new test file'
  override usage = 'make:test <name> [--unit]'

  override async handle(args: ParsedArgs): Promise<number> {
    const rawName = args.args[0]
    if (!rawName) {
      this.io.error('Please provide a test name. Usage: make:test <name>')
      return 1
    }

    const isUnit = !!args.flags['unit']
    const subDir = isUnit ? 'unit' : 'feature'
    const className = this.toClassName(rawName)
    const fileName = `${className}.test.ts`
    const dir = `${process.cwd()}/tests/${subDir}`
    const filePath = `${dir}/${fileName}`

    if (existsSync(filePath)) {
      this.io.error(`${fileName} already exists.`)
      return 1
    }

    mkdirSync(dirname(filePath), { recursive: true })

    const content = isUnit
      ? this.unitStub(className)
      : this.featureStub(className)

    await Bun.write(filePath, content)
    this.io.success(`Created tests/${subDir}/${fileName}`)
    return 0
  }

  private unitStub(name: string): string {
    return `import { describe, test, expect } from 'bun:test'

describe('${name}', () => {
  test('example', () => {
    expect(true).toBe(true)
  })
})
`
  }

  private featureStub(name: string): string {
    return `import { describe, test, expect } from 'bun:test'

describe('${name}', () => {
  test('returns a successful response', async () => {
    const response = await fetch('http://localhost:3000/api/ping')
    expect(response.status).toBe(200)
  })
})
`
  }

  private toClassName(name: string): string {
    return name
      .replace(/[-_]+(.)/g, (_, c: string) => c.toUpperCase())
      .replace(/^(.)/, (_, c: string) => c.toUpperCase())
  }
}
