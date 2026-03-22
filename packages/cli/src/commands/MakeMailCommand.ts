import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeMailCommand extends GeneratorCommand {
  override name = 'make:mail'
  override description = 'Create a new mailable class'
  override usage = 'make:mail <name>'

  override directory() { return 'app/Mail' }
  override suffix() { return '' }

  override stub(name: string): string {
    return `import { Mailable } from '@mantiq/mail'

export class ${name} extends Mailable {
  constructor(private readonly data: Record<string, any> = {}) {
    super()
  }

  override build(): void {
    this.setSubject('${this.toSubject(name)}')
    this.html(\`
      <h1>${this.toSubject(name)}</h1>
      <p>This is the ${name} mailable.</p>
    \`)
  }
}
`
  }

  private toSubject(name: string): string {
    return name.replace(/([A-Z])/g, ' $1').trim()
  }
}
