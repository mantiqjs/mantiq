import { GeneratorCommand } from '@mantiq/cli'

/**
 * Generate a new AI agent tool.
 *
 * Usage: bun mantiq make:ai-tool SearchDatabase
 */
export class MakeAIToolCommand extends GeneratorCommand {
  override name = 'make:ai-tool'
  override description = 'Create a new AI agent tool class'
  override usage = 'make:ai-tool <name>'

  override directory(): string {
    return 'app/AI/Tools'
  }

  override suffix(): string {
    return 'Tool'
  }

  override stub(name: string): string {
    return `import { AgentTool } from '@mantiq/ai'

export class ${name} extends AgentTool {
  override name = '${this.toSnakeCase(name)}'
  override description = 'Describe what this tool does'
  override parameters = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The input query' },
    },
    required: ['query'],
  }

  override async execute(args: Record<string, any>): Promise<string> {
    // TODO: Implement tool logic
    return JSON.stringify({ result: args.query })
  }
}
`
  }

  private toSnakeCase(name: string): string {
    return name
      .replace(/Tool$/, '')
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
  }
}
