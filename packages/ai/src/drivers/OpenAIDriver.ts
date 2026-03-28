import type { AIDriver } from '../contracts/AIDriver.ts'
import type { ChatMessage, ChatOptions, ChatResponse, ChatChunk } from '../contracts/ChatMessage.ts'
import type { EmbedOptions, EmbeddingResult } from '../contracts/Embedding.ts'
import type { ImageGenerateOptions, ImageResult } from '../contracts/Image.ts'
import type { AudioSpeechOptions, AudioTranscribeOptions, TranscriptionResult } from '../contracts/Audio.ts'
import type { ModerationOptions, ModerationResult } from '../contracts/Moderation.ts'
import { AIError } from '../errors/AIError.ts'

export interface OpenAIConfig {
  apiKey: string
  organization?: string
  baseUrl?: string
}

/**
 * OpenAI driver — supports chat, streaming, embeddings, images (DALL-E),
 * audio (TTS/STT via Whisper), and moderation.
 */
export class OpenAIDriver implements AIDriver {
  private baseUrl: string

  constructor(private config: OpenAIConfig) {
    this.baseUrl = config.baseUrl?.replace(/\/$/, '') ?? 'https://api.openai.com/v1'
  }

  // ── Chat ───────────────────────────────────────────────────────────────

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const body = this.buildChatBody(messages, options)
    const data = await this.post('/chat/completions', body)
    return this.parseChatResponse(data)
  }

  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<ChatChunk> {
    const body = this.buildChatBody(messages, options)
    body.stream = true
    body.stream_options = { include_usage: true }

    const response = await this.request('/chat/completions', body)
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
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const payload = trimmed.slice(6)
        if (payload === '[DONE]') return

        const chunk = JSON.parse(payload) as any
        const choice = chunk.choices?.[0]
        if (!choice) continue

        yield {
          id: chunk.id,
          delta: choice.delta?.content ?? '',
          toolCalls: choice.delta?.tool_calls,
          finishReason: choice.finish_reason ?? undefined,
          usage: chunk.usage ? {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          } : undefined,
        }
      }
    }
  }

  // ── Embeddings ─────────────────────────────────────────────────────────

  async embed(input: string | string[], options?: EmbedOptions): Promise<EmbeddingResult> {
    const body: Record<string, any> = {
      input,
      model: options?.model ?? 'text-embedding-3-small',
    }
    if (options?.dimensions) body.dimensions = options.dimensions
    if (options?.encodingFormat) body.encoding_format = options.encodingFormat

    const data = await this.post('/embeddings', body)
    return {
      embeddings: data.data.map((d: any) => d.embedding),
      model: data.model,
      usage: { totalTokens: data.usage.total_tokens },
    }
  }

  // ── Image Generation ───────────────────────────────────────────────────

  async generateImage(prompt: string, options?: ImageGenerateOptions): Promise<ImageResult> {
    const body: Record<string, any> = {
      prompt,
      model: options?.model ?? 'dall-e-3',
      n: options?.n ?? 1,
    }
    if (options?.size) body.size = options.size
    if (options?.quality) body.quality = options.quality
    if (options?.style) body.style = options.style
    if (options?.responseFormat) body.response_format = options.responseFormat

    const data = await this.post('/images/generations', body)
    return {
      images: data.data.map((img: any) => ({
        url: img.url,
        b64Json: img.b64_json,
        revisedPrompt: img.revised_prompt,
      })),
      model: body.model,
    }
  }

  // ── Audio TTS ──────────────────────────────────────────────────────────

  async speak(text: string, options?: AudioSpeechOptions): Promise<Uint8Array> {
    const body = {
      model: options?.model ?? 'tts-1',
      input: text,
      voice: options?.voice ?? 'alloy',
      speed: options?.speed,
      response_format: options?.responseFormat ?? 'mp3',
    }

    const response = await this.request('/audio/speech', body)
    const arrayBuffer = await response.arrayBuffer()
    return new Uint8Array(arrayBuffer)
  }

  // ── Audio STT ──────────────────────────────────────────────────────────

  async transcribe(audio: Uint8Array | string, options?: AudioTranscribeOptions): Promise<TranscriptionResult> {
    const formData = new FormData()
    if (typeof audio === 'string') {
      const file = Bun.file(audio)
      formData.append('file', file)
    } else {
      formData.append('file', new Blob([audio], { type: 'audio/wav' }), 'audio.wav')
    }
    formData.append('model', options?.model ?? 'whisper-1')
    if (options?.language) formData.append('language', options.language)
    if (options?.prompt) formData.append('prompt', options.prompt)
    if (options?.responseFormat) formData.append('response_format', options.responseFormat)
    if (options?.temperature !== undefined) formData.append('temperature', String(options.temperature))

    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: this.headers(false),
      body: formData,
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new AIError(`OpenAI API error: ${response.status}`, { status: response.status, body: errorBody })
    }

    const data = await response.json() as any
    return {
      text: data.text,
      language: data.language,
      duration: data.duration,
      segments: data.segments,
      words: data.words,
    }
  }

  // ── Moderation ─────────────────────────────────────────────────────────

  async moderate(input: string | string[], options?: ModerationOptions): Promise<ModerationResult> {
    const body: Record<string, any> = { input }
    if (options?.model) body.model = options.model

    const data = await this.post('/moderations', body)
    return {
      id: data.id,
      results: data.results.map((r: any) => ({
        flagged: r.flagged,
        categories: r.categories,
        categoryScores: r.category_scores,
      })),
    }
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private buildChatBody(messages: ChatMessage[], options?: ChatOptions): Record<string, any> {
    const body: Record<string, any> = {
      model: options?.model ?? 'gpt-4o',
      messages: messages.map((m) => this.formatMessage(m)),
    }

    if (options?.temperature !== undefined) body.temperature = options.temperature
    if (options?.maxTokens !== undefined) body.max_tokens = options.maxTokens
    if (options?.topP !== undefined) body.top_p = options.topP
    if (options?.frequencyPenalty !== undefined) body.frequency_penalty = options.frequencyPenalty
    if (options?.presencePenalty !== undefined) body.presence_penalty = options.presencePenalty
    if (options?.stop) body.stop = options.stop
    if (options?.seed !== undefined) body.seed = options.seed
    if (options?.user) body.user = options.user

    if (options?.tools?.length) {
      body.tools = options.tools
      if (options.toolChoice) body.tool_choice = options.toolChoice
    }

    if (options?.responseFormat) {
      if (options.responseFormat === 'json') {
        body.response_format = { type: 'json_object' }
      } else if (options.responseFormat === 'text') {
        body.response_format = { type: 'text' }
      } else {
        body.response_format = options.responseFormat
      }
    }

    return body
  }

  private formatMessage(msg: ChatMessage): Record<string, any> {
    const formatted: Record<string, any> = { role: msg.role }

    if (typeof msg.content === 'string') {
      formatted.content = msg.content
    } else {
      formatted.content = msg.content.map((part) => {
        switch (part.type) {
          case 'text':
            return { type: 'text', text: part.text }
          case 'image_url':
            return { type: 'image_url', image_url: { url: part.imageUrl, detail: part.detail } }
          case 'image_base64':
            return { type: 'image_url', image_url: { url: `data:${part.mimeType};base64,${part.imageBase64}` } }
          case 'audio':
            return { type: 'input_audio', input_audio: { data: part.audioBase64, format: part.mimeType.split('/')[1] } }
          default:
            return { type: 'text', text: JSON.stringify(part) }
        }
      })
    }

    if (msg.name) formatted.name = msg.name
    if (msg.toolCallId) formatted.tool_call_id = msg.toolCallId
    if (msg.toolCalls) formatted.tool_calls = msg.toolCalls

    return formatted
  }

  private parseChatResponse(data: any): ChatResponse {
    const choice = data.choices[0]
    return {
      id: data.id,
      content: choice.message.content ?? '',
      role: 'assistant',
      model: data.model,
      toolCalls: choice.message.tool_calls ?? [],
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason,
      raw: data,
    }
  }

  private headers(json = true): Record<string, string> {
    const h: Record<string, string> = { 'Authorization': `Bearer ${this.config.apiKey}` }
    if (json) h['Content-Type'] = 'application/json'
    if (this.config.organization) h['OpenAI-Organization'] = this.config.organization
    return h
  }

  private async request(path: string, body: Record<string, any>): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new AIError(`OpenAI API error: ${response.status}`, { status: response.status, body: errorBody })
    }

    return response
  }

  private async post(path: string, body: Record<string, any>): Promise<any> {
    const response = await this.request(path, body)
    return response.json()
  }
}
