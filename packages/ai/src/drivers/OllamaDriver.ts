import type { AIDriver } from '../contracts/AIDriver.ts'
import type { ChatMessage, ChatOptions, ChatResponse, ChatChunk } from '../contracts/ChatMessage.ts'
import type { EmbedOptions, EmbeddingResult } from '../contracts/Embedding.ts'
import type { ImageGenerateOptions, ImageResult } from '../contracts/Image.ts'
import type { AudioSpeechOptions, AudioTranscribeOptions, TranscriptionResult } from '../contracts/Audio.ts'
import type { ModerationOptions, ModerationResult } from '../contracts/Moderation.ts'
import { AIError } from '../errors/AIError.ts'

export interface OllamaConfig {
  host?: string
  port?: number
}

/**
 * Ollama driver — local model inference.
 * Supports chat, streaming, embeddings, and vision (via multimodal models).
 */
export class OllamaDriver implements AIDriver {
  private baseUrl: string

  constructor(config: OllamaConfig) {
    const host = config.host ?? 'http://localhost'
    const port = config.port ?? 11434
    this.baseUrl = `${host}:${port}`
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const body = {
      model: options?.model ?? 'llama3.2',
      messages: messages.map((m) => this.formatMessage(m)),
      stream: false,
      options: this.buildOptions(options),
    }

    if (options?.tools?.length) {
      (body as any).tools = options.tools
    }

    if (options?.responseFormat === 'json') {
      (body as any).format = 'json'
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new AIError(`Ollama API error: ${response.status}`, { status: response.status, body: errorBody })
    }

    const data = await response.json() as any
    return {
      id: crypto.randomUUID(),
      content: data.message?.content ?? '',
      role: 'assistant',
      model: data.model,
      toolCalls: data.message?.tool_calls?.map((tc: any) => ({
        id: crypto.randomUUID(),
        type: 'function' as const,
        function: { name: tc.function.name, arguments: JSON.stringify(tc.function.arguments) },
      })) ?? [],
      usage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
      finishReason: data.done_reason === 'stop' ? 'stop' : 'stop',
      raw: data,
    }
  }

  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<ChatChunk> {
    const body = {
      model: options?.model ?? 'llama3.2',
      messages: messages.map((m) => this.formatMessage(m)),
      stream: true,
      options: this.buildOptions(options),
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new AIError(`Ollama API error: ${response.status}`, { status: response.status, body: errorBody })
    }

    const reader = response.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        const chunk = JSON.parse(line) as any

        yield {
          id: '',
          delta: chunk.message?.content ?? '',
          finishReason: chunk.done ? 'stop' : undefined,
        }
      }
    }
  }

  async embed(input: string | string[], options?: EmbedOptions): Promise<EmbeddingResult> {
    const inputs = Array.isArray(input) ? input : [input]
    const results: number[][] = []

    for (const text of inputs) {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: options?.model ?? 'nomic-embed-text', prompt: text }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        throw new AIError(`Ollama API error: ${response.status}`, { status: response.status, body: errorBody })
      }

      const data = await response.json() as any
      results.push(data.embedding)
    }

    return {
      embeddings: results,
      model: options?.model ?? 'nomic-embed-text',
      usage: { totalTokens: 0 },
    }
  }

  async generateImage(_prompt: string, _options?: ImageGenerateOptions): Promise<ImageResult> {
    throw new AIError('Ollama does not support image generation.')
  }

  async speak(_text: string, _options?: AudioSpeechOptions): Promise<Uint8Array> {
    throw new AIError('Ollama does not support text-to-speech.')
  }

  async transcribe(_audio: Uint8Array | string, _options?: AudioTranscribeOptions): Promise<TranscriptionResult> {
    throw new AIError('Ollama does not support speech-to-text.')
  }

  async moderate(_input: string | string[], _options?: ModerationOptions): Promise<ModerationResult> {
    throw new AIError('Ollama does not support moderation.')
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private formatMessage(msg: ChatMessage): Record<string, any> {
    const formatted: Record<string, any> = {
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : msg.content.map((p) => ('text' in p ? p.text : '')).join(''),
    }

    // Ollama supports images via the `images` field (base64)
    if (Array.isArray(msg.content)) {
      const images = msg.content
        .filter((p) => p.type === 'image_base64')
        .map((p) => (p as any).imageBase64)
      if (images.length > 0) formatted.images = images
    }

    return formatted
  }

  private buildOptions(options?: ChatOptions): Record<string, any> {
    const opts: Record<string, any> = {}
    if (options?.temperature !== undefined) opts.temperature = options.temperature
    if (options?.topP !== undefined) opts.top_p = options.topP
    if (options?.topK !== undefined) opts.top_k = options.topK
    if (options?.stop) opts.stop = options.stop
    if (options?.maxTokens !== undefined) opts.num_predict = options.maxTokens
    if (options?.seed !== undefined) opts.seed = options.seed
    if (options?.frequencyPenalty !== undefined) opts.frequency_penalty = options.frequencyPenalty
    if (options?.presencePenalty !== undefined) opts.presence_penalty = options.presencePenalty
    return opts
  }
}
