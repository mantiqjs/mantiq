import type { AIManager } from './AIManager.ts'
import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ChatChunk,
  ContentPart,
  ToolDefinition,
  ResponseFormat,
} from './contracts/ChatMessage.ts'
import type { AIMiddleware, AIRequest, AINextFunction } from './middleware/AIMiddleware.ts'

/**
 * Fluent builder for AI chat requests.
 *
 * @example
 *   const response = await ai()
 *     .chat('gpt-4o')
 *     .system('You are a helpful assistant.')
 *     .user('Explain TypeScript generics.')
 *     .temperature(0.7)
 *     .send()
 *
 *   // Streaming
 *   for await (const chunk of ai('gpt-4o').user('Write a poem.').stream()) {
 *     process.stdout.write(chunk.delta)
 *   }
 *
 *   // Vision
 *   const response = await ai('gpt-4o')
 *     .user([
 *       { type: 'text', text: 'What is in this image?' },
 *       { type: 'image_url', imageUrl: 'https://example.com/photo.jpg' },
 *     ])
 *     .send()
 *
 *   // Structured output
 *   const response = await ai('gpt-4o')
 *     .user('List 3 colors')
 *     .structuredOutput({ type: 'object', properties: { colors: { type: 'array', items: { type: 'string' } } } })
 *     .send()
 */
export class PendingChat {
  private _messages: ChatMessage[] = []
  private _model?: string
  private _options: Partial<ChatOptions> = {}
  private _provider?: string

  constructor(private manager: AIManager) {}

  // ── Messages ────────────────────────────────────────────────────────────

  /** Add a system message. */
  system(content: string): this {
    this._messages.push({ role: 'system', content })
    return this
  }

  /** Add a user message (text or multimodal content parts). */
  user(content: string | ContentPart[]): this {
    this._messages.push({ role: 'user', content })
    return this
  }

  /** Add an assistant message. */
  assistant(content: string): this {
    this._messages.push({ role: 'assistant', content })
    return this
  }

  /** Add a tool result message. */
  tool(toolCallId: string, content: string): this {
    this._messages.push({ role: 'tool', content, toolCallId })
    return this
  }

  /** Set all messages at once. */
  messages(msgs: ChatMessage[]): this {
    this._messages = [...msgs]
    return this
  }

  // ── Configuration ──────────────────────────────────────────────────────

  /** Set the model to use. */
  model(name: string): this {
    this._model = name
    return this
  }

  /** Set the temperature (0-2). */
  temperature(t: number): this {
    this._options.temperature = t
    return this
  }

  /** Set the maximum number of tokens to generate. */
  maxTokens(n: number): this {
    this._options.maxTokens = n
    return this
  }

  /** Set top-p (nucleus sampling). */
  topP(p: number): this {
    this._options.topP = p
    return this
  }

  /** Set top-k sampling. */
  topK(k: number): this {
    this._options.topK = k
    return this
  }

  /** Set stop sequences. */
  stop(sequences: string[]): this {
    this._options.stop = sequences
    return this
  }

  /** Set frequency penalty. */
  frequencyPenalty(p: number): this {
    this._options.frequencyPenalty = p
    return this
  }

  /** Set presence penalty. */
  presencePenalty(p: number): this {
    this._options.presencePenalty = p
    return this
  }

  /** Provide tool definitions for function calling. */
  tools(defs: ToolDefinition[]): this {
    this._options.tools = defs
    return this
  }

  /** Set tool choice strategy. */
  toolChoice(choice: NonNullable<ChatOptions['toolChoice']>): this {
    this._options.toolChoice = choice
    return this
  }

  /** Request JSON output. */
  jsonMode(): this {
    this._options.responseFormat = 'json'
    return this
  }

  /** Request structured output with a JSON schema. */
  structuredOutput(schema: Record<string, any>, name?: string): this {
    const format: { type: 'json_schema'; schema: Record<string, any>; name?: string; strict?: boolean } = {
      type: 'json_schema', schema, strict: true,
    }
    if (name) format.name = name
    this._options.responseFormat = format
    return this
  }

  /** Set raw response format. */
  responseFormat(format: ResponseFormat): this {
    this._options.responseFormat = format
    return this
  }

  /** Set a seed for deterministic output. */
  seed(s: number): this {
    this._options.seed = s
    return this
  }

  /** Set user identifier for tracking. */
  userIdentifier(id: string): this {
    this._options.user = id
    return this
  }

  /** Attach metadata. */
  metadata(data: Record<string, any>): this {
    this._options.metadata = { ...this._options.metadata, ...data }
    return this
  }

  /** Use a specific provider instead of the default. */
  via(provider: string): this {
    this._provider = provider
    return this
  }

  // ── Execution ─────────────────────────────────────────────────────────

  /** Send the chat request and return the full response. */
  async send(): Promise<ChatResponse> {
    const driver = this.manager.driver(this._provider)
    const options: ChatOptions = { ...this._options }
    if (this._model) options.model = this._model

    const middlewares = this.manager.getMiddlewares()
    if (middlewares.length === 0) {
      return driver.chat(this._messages, options)
    }

    const request: AIRequest = {
      messages: this._messages,
      options,
      provider: this._provider ?? this.manager.getDefaultDriver(),
      metadata: {},
    }

    const dispatch = (index: number): AINextFunction => {
      return (req: AIRequest) => {
        if (index >= middlewares.length) {
          return driver.chat(req.messages, req.options)
        }
        return middlewares[index]!.handle(req, dispatch(index + 1))
      }
    }

    return dispatch(0)(request)
  }

  /** Stream the chat response as an async iterable of chunks. */
  stream(): AsyncIterable<ChatChunk> {
    const driver = this.manager.driver(this._provider)
    const options: ChatOptions = { ...this._options }
    if (this._model) options.model = this._model
    return driver.stream(this._messages, options)
  }
}
