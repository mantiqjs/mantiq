import type { AIManager } from '../AIManager.ts'
import type { ChatMessage, ChatResponse } from '../contracts/ChatMessage.ts'
import type { AgentTool } from './AgentTool.ts'
import type { Memory } from './Memory.ts'
import { BufferMemory } from './Memory.ts'
import { AIError } from '../errors/AIError.ts'

export interface AgentOptions {
  model?: string
  provider?: string
  systemPrompt?: string
  maxIterations?: number
  memory?: Memory
  onToolCall?: (name: string, args: Record<string, any>) => void
  onResponse?: (response: ChatResponse) => void
}

export interface AgentResult {
  content: string
  iterations: number
  toolCallsExecuted: { name: string; args: Record<string, any>; result: string }[]
  totalTokens: number
}

/**
 * AI Agent — autonomous tool-using loop.
 *
 * @example
 *   const agent = new Agent(ai(), {
 *     model: 'gpt-4o',
 *     systemPrompt: 'You are a helpful assistant with access to tools.',
 *   })
 *   agent.addTool(new SearchTool())
 *   agent.addTool(new CalculatorTool())
 *
 *   const result = await agent.run('Find all overdue invoices and calculate the total')
 */
export class Agent {
  private tools: AgentTool[] = []
  private memory: Memory
  private model: string | undefined
  private provider: string | undefined
  private systemPrompt: string | undefined
  private maxIterations: number
  private onToolCall: ((name: string, args: Record<string, any>) => void) | undefined
  private onResponse: ((response: ChatResponse) => void) | undefined

  constructor(private manager: AIManager, options?: AgentOptions) {
    this.memory = options?.memory ?? new BufferMemory()
    this.model = options?.model ?? undefined
    this.provider = options?.provider ?? undefined
    this.systemPrompt = options?.systemPrompt ?? undefined
    this.maxIterations = options?.maxIterations ?? 10
    this.onToolCall = options?.onToolCall ?? undefined
    this.onResponse = options?.onResponse ?? undefined
  }

  /** Add a tool the agent can use. */
  addTool(tool: AgentTool): this {
    this.tools.push(tool)
    return this
  }

  /** Set the memory implementation. */
  setMemory(memory: Memory): this {
    this.memory = memory
    return this
  }

  /** Set the maximum number of iterations. */
  setMaxIterations(n: number): this {
    this.maxIterations = n
    return this
  }

  /** Run the agent with the given input. */
  async run(input: string): Promise<AgentResult> {
    const toolCallsExecuted: AgentResult['toolCallsExecuted'] = []
    let totalTokens = 0
    let iterations = 0

    // Add system prompt if set
    if (this.systemPrompt && this.memory.getMessages().length === 0) {
      this.memory.add({ role: 'system', content: this.systemPrompt })
    }

    // Add user input
    this.memory.add({ role: 'user', content: input })

    while (iterations < this.maxIterations) {
      iterations++

      const pending = this.manager.chat(this.model)
      if (this.provider) pending.via(this.provider)
      if (this.tools.length > 0) pending.tools(this.tools.map((t) => t.toDefinition()))

      const response = await pending.messages(this.memory.getMessages()).send()
      totalTokens += response.usage.totalTokens

      this.onResponse?.(response)

      // Add assistant message to memory
      const assistantMsg: ChatMessage = { role: 'assistant', content: response.content }
      if (response.toolCalls.length > 0) assistantMsg.toolCalls = response.toolCalls
      this.memory.add(assistantMsg)

      // If no tool calls, we're done
      if (response.finishReason !== 'tool_calls' || response.toolCalls.length === 0) {
        return { content: response.content, iterations, toolCallsExecuted, totalTokens }
      }

      // Execute each tool call
      for (const toolCall of response.toolCalls) {
        const tool = this.tools.find((t) => t.name === toolCall.function.name)
        if (!tool) {
          const result = `Error: Unknown tool "${toolCall.function.name}"`
          this.memory.add({ role: 'tool', content: result, toolCallId: toolCall.id })
          toolCallsExecuted.push({ name: toolCall.function.name, args: {}, result })
          continue
        }

        const args = JSON.parse(toolCall.function.arguments)

        // Fix #178: Validate tool arguments against parameter schema before execution
        const validationError = validateToolArgs(args, tool.parameters)
        if (validationError) {
          const result = `Error: Invalid arguments for tool "${tool.name}": ${validationError}`
          this.memory.add({ role: 'tool', content: result, toolCallId: toolCall.id })
          toolCallsExecuted.push({ name: tool.name, args, result })
          continue
        }

        this.onToolCall?.(tool.name, args)

        let result: string
        try {
          result = await tool.execute(args)
        } catch (err: any) {
          result = `Error executing tool "${tool.name}": ${err.message}`
        }

        this.memory.add({ role: 'tool', content: result, toolCallId: toolCall.id })
        toolCallsExecuted.push({ name: tool.name, args, result })
      }
    }

    throw new AIError(`Agent exceeded maximum iterations (${this.maxIterations})`)
  }
}

/**
 * Basic structural validation of tool arguments against a JSON schema definition.
 * Checks required fields are present and top-level types match.
 * Returns an error string if validation fails, or null if valid.
 */
function validateToolArgs(args: Record<string, any>, schema: Record<string, any>): string | null {
  if (schema.type === 'object') {
    if (typeof args !== 'object' || args === null || Array.isArray(args)) {
      return 'Expected an object'
    }

    // Check required fields
    const required: string[] = schema.required ?? []
    for (const field of required) {
      if (!(field in args) || args[field] === undefined) {
        return `Missing required field: "${field}"`
      }
    }

    // Check top-level property types when defined
    const properties: Record<string, any> = schema.properties ?? {}
    for (const [key, value] of Object.entries(args)) {
      const propSchema = properties[key]
      if (!propSchema || !propSchema.type) continue

      const expectedType = propSchema.type
      const actualType = Array.isArray(value) ? 'array' : typeof value

      // Map JSON schema types to JS typeof results
      const typeMatches =
        (expectedType === 'string' && actualType === 'string') ||
        (expectedType === 'number' && actualType === 'number') ||
        (expectedType === 'integer' && actualType === 'number' && Number.isInteger(value)) ||
        (expectedType === 'boolean' && actualType === 'boolean') ||
        (expectedType === 'array' && actualType === 'array') ||
        (expectedType === 'object' && actualType === 'object') ||
        value === null // null is acceptable for any type

      if (!typeMatches) {
        return `Field "${key}" expected type "${expectedType}" but got "${actualType}"`
      }
    }
  }

  return null
}
