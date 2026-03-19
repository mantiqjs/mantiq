import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Base class for make:* generators.
 * Subclasses provide the target directory, file suffix, and stub content.
 */
export abstract class GeneratorCommand extends Command {
  /** Directory relative to project root, e.g. 'app/Http/Controllers' */
  abstract directory(): string

  /** File suffix, e.g. 'Controller' — will be appended to the name */
  abstract suffix(): string

  /** Generate the file content */
  abstract stub(name: string, args: ParsedArgs): string

  async handle(args: ParsedArgs): Promise<number> {
    const rawName = args.args[0]
    if (!rawName) {
      this.io.error(`Please provide a name. Usage: ${this.name} <name>`)
      return 1
    }

    const className = this.toClassName(rawName)
    const fileName = `${className}${this.suffix()}.ts`
    const dir = `${process.cwd()}/${this.directory()}`
    const filePath = `${dir}/${fileName}`

    if (existsSync(filePath)) {
      this.io.error(`${fileName} already exists.`)
      return 1
    }

    // Ensure directory exists
    mkdirSync(dirname(filePath), { recursive: true })

    const content = this.stub(className, args)
    await Bun.write(filePath, content)

    this.io.success(`Created ${this.directory()}/${fileName}`)
    return 0
  }

  protected toClassName(name: string): string {
    // Remove suffix if already present
    const sfx = this.suffix()
    if (sfx && name.endsWith(sfx)) {
      name = name.slice(0, -sfx.length)
    }
    // PascalCase: foo_bar -> FooBar, foo-bar -> FooBar
    return name
      .replace(/[-_]+(.)/g, (_, c) => c.toUpperCase())
      .replace(/^(.)/, (_, c) => c.toUpperCase())
  }
}
