import { GeneratorCommand } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'

export class MakeMailCommand extends GeneratorCommand {
  override name = 'make:mail'
  override description = 'Create a new mailable class'
  override usage = 'make:mail <name> [--markdown]'

  override directory() { return 'app/Mail' }
  override suffix() { return '' }

  override stub(name: string, args: ParsedArgs): string {
    const className = name
    const useMarkdown = !!args.flags['markdown']

    if (useMarkdown) {
      return `import { Mailable } from '@mantiq/mail'

export class ${className} extends Mailable {
  constructor(private data: Record<string, any> = {}) { super() }

  build() {
    this.setSubject('${className}')
    this.markdown(\`
# Hello!

This is the **${className}** mailable.

[button url="/dashboard"]View Dashboard[/button]

[panel]
If you have any questions, reply to this email.
[/panel]
    \`)
  }
}
`
    }

    return `import { Mailable } from '@mantiq/mail'

export class ${className} extends Mailable {
  constructor(private data: Record<string, any> = {}) { super() }

  build() {
    this.setSubject('${className}')
    this.html(\`
      <h1>Hello!</h1>
      <p>This is the <strong>${className}</strong> mailable.</p>
    \`)
  }
}
`
  }
}
