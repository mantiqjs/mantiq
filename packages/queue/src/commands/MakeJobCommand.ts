import { GeneratorCommand } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'

export class MakeJobCommand extends GeneratorCommand {
  override name = 'make:job'
  override description = 'Create a new job class'
  override usage = 'make:job <name>'

  override directory() { return 'app/Jobs' }
  override suffix() { return '' }

  override stub(name: string, _args: ParsedArgs): string {
    return `import { Job } from '@mantiq/queue'

export class ${name} extends Job {
  override queue = 'default'
  override tries = 3

  constructor() {
    super()
  }

  override async handle(): Promise<void> {
    //
  }
}
`
  }
}
