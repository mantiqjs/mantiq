import type { ToolDefinition } from '../contracts/ChatMessage.ts'

/**
 * Base class for user-defined AI agent tools.
 *
 * @example
 *   class SearchDatabaseTool extends AgentTool {
 *     name = 'search_database'
 *     description = 'Search the database for records matching a query'
 *     parameters = {
 *       type: 'object',
 *       properties: {
 *         query: { type: 'string', description: 'The search query' },
 *         table: { type: 'string', description: 'Table to search in' },
 *       },
 *       required: ['query'],
 *     }
 *
 *     async execute(args: Record<string, any>): Promise<string> {
 *       const results = await db.table(args.table).where('name', 'like', `%${args.query}%`).get()
 *       return JSON.stringify(results)
 *     }
 *   }
 */
export abstract class AgentTool {
  abstract name: string
  abstract description: string
  abstract parameters: Record<string, any>

  /** Execute the tool with the given arguments. Return a string result. */
  abstract execute(args: Record<string, any>): Promise<string>

  /** Convert to the ToolDefinition format used by AI providers. */
  toDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    }
  }
}
