import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeProviderCommand extends GeneratorCommand {
  override name = 'make:provider'
  override description = 'Create a new service provider class'
  override usage = 'make:provider <name>'

  override directory() { return 'app/Providers' }
  override suffix() { return 'ServiceProvider' }

  override stub(name: string, _args: ParsedArgs): string {
    const className = `${name}ServiceProvider`
    return `import { ServiceProvider } from '@mantiq/core'

export class ${className} extends ServiceProvider {
  override register(): void {
    // Register bindings into the container
  }

  override async boot(): Promise<void> {
    // Boot application services
  }
}
`
  }
}
