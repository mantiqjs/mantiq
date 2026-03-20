import { GeneratorCommand } from './GeneratorCommand.ts'
import type { ParsedArgs } from '../Parser.ts'

export class MakeControllerCommand extends GeneratorCommand {
  override name = 'make:controller'
  override description = 'Create a new controller class'
  override usage = 'make:controller <name> [--resource]'

  override directory() { return 'app/Http/Controllers' }
  override suffix() { return 'Controller' }

  override stub(name: string, args: ParsedArgs): string {
    const className = `${name}Controller`
    const isResource = !!args.flags['resource'] || !!args.flags['r']

    if (isResource) {
      return `import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'

export class ${className} {
  async index(request: MantiqRequest): Promise<Response> {
    return MantiqResponse.json({ data: [] })
  }

  async show(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    return MantiqResponse.json({ data: { id } })
  }

  async store(request: MantiqRequest): Promise<Response> {
    const body = await request.input()
    return MantiqResponse.json({ data: body }, 201)
  }

  async update(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const body = await request.input()
    return MantiqResponse.json({ data: { id, ...body } })
  }

  async destroy(request: MantiqRequest): Promise<Response> {
    return MantiqResponse.noContent()
  }
}
`
    }

    return `import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'

export class ${className} {
  async index(request: MantiqRequest): Promise<Response> {
    return MantiqResponse.json({ data: [] })
  }
}
`
  }
}
