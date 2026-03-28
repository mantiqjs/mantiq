import type { AIDriver } from '../contracts/AIDriver.ts'
import type { ChatMessage, ChatOptions, ChatResponse, ChatChunk } from '../contracts/ChatMessage.ts'
import type { EmbedOptions, EmbeddingResult } from '../contracts/Embedding.ts'
import type { ImageGenerateOptions, ImageResult } from '../contracts/Image.ts'
import type { AudioSpeechOptions, AudioTranscribeOptions, TranscriptionResult } from '../contracts/Audio.ts'
import type { ModerationOptions, ModerationResult } from '../contracts/Moderation.ts'
import { AIError } from '../errors/AIError.ts'

export interface AnthropicConfig {
  apiKey: string
  baseUrl?: string
  apiVersion?: string
}

/**
 * Anthropic driver — supports chat, streaming, and vision.
 * Embeddings, images, audio, and moderation throw AIError (not supported).
 */
export class AnthropicDriver implements AIDriver {
  private baseUrl: string
  private apiVersion: string

  constructor(private config: AnthropicConfig) {
    this.baseUrl = config.baseUrl?.replace(/\/$/, '') ?? 'https://api.anthropic.com'
    this.apiVersion = config.apiVersion ?? '2023-06-01'
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const body = this.buildBody(messages, options)
    const data = await this.post('/v1/messages', body)
    return this.parseResponse(data)
  }

  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<ChatChunk> {
    const body = this.buildBody(messages, options)
    body.stream = true

    const response = await this.request('/v1/messages', body)
    const reader = response.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()
    let buffer = ''
    let msgId = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const payload = trimmed.slice(6)

        const event = JSON.parse(payload) as any

        if (event.type === 'message_start') {
          msgId = event.message.id
        } else if (event.type === 'content_block_delta') {
          yield {
            id: msgId,
            delta: event.delta?.text ?? '',
          }
        } else if (event.type === 'message_delta') {
          yield {
            id: msgId,
            delta: '',
            finishReason: event.delta?.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
            usage: event.usage ? {
              promptTokens: 0,
              completionTokens: event.usage.output_tokens,
              totalTokens: event.usage.output_tokens,
            } : undefined,
          }
        }
      }
    }
  }

  async embed(_input: string | string[], _options?: EmbedOptions): Promise<EmbeddingResult> {
    throw new AIError('Anthropic does not support embeddings. Use OpenAI or another provider.')
  }

  async generateImage(_prompt: string, _options?: ImageGenerateOptions): Promise<ImageResult> {
    throw new AIError('Anthropic does not support image generation.')
  }

  async speak(_text: string, _options?: AudioSpeechOptions): Promise<Uint8Array> {
    throw new AIError('Anthropic does not support text-to-speech.')
  }

  async transcribe(_audio: Uint8Array | string, _options?: AudioTranscribeOptions): Promise<TranscriptionResult> {
    throw new AIError('Anthropic does not support speech-to-text.')
  }

  async moderate(_input: string | string[], _options?: ModerationOptions): Promise<ModerationResult> {
    throw new AIError('Anthropic does not support moderation.')
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private buildBody(messages: ChatMessage[], options?: ChatOptions): Record<string, any> {
    // Anthropic uses a separate `system` field
    const systemMessages = messages.filter((m) => m.role === 'system')
    const nonSystemMessages = messages.filter((m) => m.role !== 'system')

    const body: Record<string, any> = {
      model: options?.model ?? 'claude-sonnet-4-20250514',
      messages: nonSystemMessages.map((m) => this.formatMessage(m)),
      max_tokens: options?.maxTokens ?? 4096,
    }

    if (systemMessages.length > 0) {
      body.system = systemMessages.map((m) =>
        typeof m.content === 'string' ? m.content : m.content.map((p) => ('text' in p ? p.text : '')).join('')
      ).join('\n\n')
    }

    if (options?.temperature !== undefined) body.temperature = options.temperature
    if (options?.topP !== undefined) body.top_p = options.topP
    if (options?.topK !== undefined) body.top_k = options.topK
    if (options?.stop) body.stop_sequences = options.stop

    if (options?.tools?.length) {
      body.tools = options.tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }))
    }

    return body
  }

  private formatMessage(msg: ChatMessage): Record<string, any> {
    const formatted: Record<string, any> = { role: msg.role === 'tool' ? 'user' : msg.role }

    if (msg.role === 'tool') {
      formatted.content = [{
        type: 'tool_result',
        tool_use_id: msg.toolCallId,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      }]
      return formatted
    }

    if (typeof msg.content === 'string') {
      formatted.content = msg.content
    } else {
      formatted.content = msg.content.map((part) => {
        switch (part.type) {
          case 'text':
            return { type: 'text', text: part.text }
          case 'image_url':
            return { type: 'image', source: { type: 'url', url: part.imageUrl } }
          case 'image_base64':
            return { type: 'image', source: { type: 'base64', media_type: part.mimeType, data: part.imageBase64 } }
          default:
            return { type: 'text', text: JSON.stringify(part) }
        }
      })
    }

    if (msg.toolCalls) {
      const toolBlocks = msg.toolCalls.map((tc) => ({
        type: 'tool_use',
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments),
      }))
      if (typeof formatted.content === 'string') {
        formatted.content = [{ type: 'text', text: formatted.content }, ...toolBlocks]
      } else {
        formatted.content = [...formatted.content, ...toolBlocks]
      }
    }

    return formatted
  }

  private parseResponse(data: any): ChatResponse {
    const textBlocks = data.content?.filter((b: any) => b.type === 'text') ?? []
    const toolBlocks = data.content?.filter((b: any) => b.type === 'tool_use') ?? []

    return {
      id: data.id,
      content: textBlocks.map((b: any) => b.text).join(''),
      role: 'assistant',
      model: data.model,
      toolCalls: toolBlocks.map((b: any) => ({
        id: b.id,
        type: 'function' as const,
        function: { name: b.name, arguments: JSON.stringify(b.input) },
      })),
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      finishReason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
      raw: data,
    }
  }

  private headers(): Record<string, string> {
    return {
      'x-api-key': this.config.apiKey,
      'anthropic-version': this.apiVersion,
      'Content-Type': 'application/json',
    }
  }

  private async request(path: string, body: Record<string, any>): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new AIError(`Anthropic API error: ${response.status}`, { status: response.status, body: errorBody })
    }

    return response
  }

  private async post(path: string, body: Record<string, any>): Promise<any> {
    const response = await this.request(path, body)
    return response.json()
  }
}
