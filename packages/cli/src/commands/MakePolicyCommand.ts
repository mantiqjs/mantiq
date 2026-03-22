import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakePolicyCommand extends GeneratorCommand {
  override name = 'make:policy'
  override description = 'Create a new policy class'
  override usage = 'make:policy <name> [--model=ModelName]'

  override directory() { return 'app/Policies' }
  override suffix() { return 'Policy' }

  override stub(name: string, args: ParsedArgs): string {
    const modelName = (args.flags['model'] as string) ?? name
    const modelImport = `import { ${modelName} } from '../Models/${modelName}.ts'`

    return `import { Policy } from '@mantiq/auth'
${modelImport}

export class ${name}Policy extends Policy {
  /**
   * Called before any other policy method.
   * Return true to allow, false to deny, null to continue to the specific check.
   */
  // before(user: any, ability: string): boolean | null {
  //   if (user.role === 'admin') return true
  //   return null
  // }

  view(user: any, ${modelName.toLowerCase()}: ${modelName}): boolean {
    return true
  }

  create(user: any): boolean {
    return true
  }

  update(user: any, ${modelName.toLowerCase()}: ${modelName}): boolean {
    return user.getAuthIdentifier() === ${modelName.toLowerCase()}.getAttribute('user_id')
  }

  delete(user: any, ${modelName.toLowerCase()}: ${modelName}): boolean {
    return user.getAuthIdentifier() === ${modelName.toLowerCase()}.getAttribute('user_id')
  }
}
`
  }
}
