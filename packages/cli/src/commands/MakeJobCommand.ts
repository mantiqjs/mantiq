import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeJobCommand extends GeneratorCommand {
  override name = 'make:job'
  override description = 'Create a new job class'
  override usage = 'make:job <name>'

  override directory() { return 'app/Jobs' }
  override suffix() { return '' }

  override stub(name: string): string {
    return `import { Job } from '@mantiq/queue'

export class ${name} extends Job {
  override tries = 3
  override backoff = 10

  constructor(public readonly data: Record<string, any> = {}) {
    super()
  }

  override async handle(): Promise<void> {
    // TODO: implement ${name} job logic
  }

  override async failed(error: Error): Promise<void> {
    // TODO: handle failure (e.g., log, notify)
    console.error(\`${name} failed: \${error.message}\`)
  }
}
`
  }
}
