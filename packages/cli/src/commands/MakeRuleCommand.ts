import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeRuleCommand extends GeneratorCommand {
  override name = 'make:rule'
  override description = 'Create a new validation rule'
  override usage = 'make:rule <name>'

  override directory() { return 'app/Rules' }
  override suffix() { return 'Rule' }

  override stub(name: string, _args: ParsedArgs): string {
    const className = `${name}Rule`
    const ruleName = this.toRuleName(name)
    return `import type { ValidationRule } from '@mantiq/validation'

export const ${ruleName}: ValidationRule = {
  name: '${ruleName}',

  validate(value: unknown, args: string[], field: string): boolean | string {
    // Return true if valid, or a string error message if invalid
    return true
  },
}

export class ${className} {
  /** Register this rule with the validator */
  static rule(): ValidationRule {
    return ${ruleName}
  }
}
`
  }

  private toRuleName(name: string): string {
    return name.charAt(0).toLowerCase() + name.slice(1)
  }
}
