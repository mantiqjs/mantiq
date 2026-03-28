import type { AIDriver } from '../contracts/AIDriver.ts'
import type { ChatMessage, ChatOptions, ChatResponse, ChatChunk } from '../contracts/ChatMessage.ts'
import type { EmbedOptions, EmbeddingResult } from '../contracts/Embedding.ts'
import type { ImageGenerateOptions, ImageResult } from '../contracts/Image.ts'
import type { AudioSpeechOptions, AudioTranscribeOptions, TranscriptionResult } from '../contracts/Audio.ts'
import type { ModerationOptions, ModerationResult } from '../contracts/Moderation.ts'
import { AIError } from '../errors/AIError.ts'

export interface GeminiConfig {
  apiKey: string
  project?: string
  location?: string
}

/**
 * Google Gemini driver — supports chat, streaming, embeddings, vision,
 * and multimodal input (audio, video, files).
 */
export class GeminiDriver implements AIDriver {
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta'

  constructor(private config: GeminiConfig) {}

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const model = options?.model ?? 'gemini-2.0-flash'
    const body = this.buildBody(messages, options)
    const data = await this.post(`/models/${model}:generateContent`, body)
    return this.parseResponse(data, model)
  }

  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<ChatChunk> {
    const model = options?.model ?? 'gemini-2.0-flash'
    const body = this.buildBody(messages, options)

    const response = await fetch(
      `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.config.apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    )

    if (!response.ok) {
      const errorBody = await response.text()
      throw new AIError(`Gemini API error: ${response.status}`, { status: response.status, body: errorBody })
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
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const chunk = JSON.parse(trimmed.slice(6)) as any
        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

        yield { id: '', delta: text }
      }
    }
  }

  async embed(input: string | string[], options?: EmbedOptions): Promise<EmbeddingResult> {
    const model = options?.model ?? 'text-embedding-004'
    const inputs = Array.isArray(input) ? input : [input]

    const body = {
      requests: inputs.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
      })),
    }

    const data = await this.post(`/models/${model}:batchEmbedContents`, body)
    return {
      embeddings: data.embeddings.map((e: any) => e.values),
      model,
      usage: { totalTokens: 0 },
    }
  }

  async generateImage(prompt: string, options?: ImageGenerateOptions): Promise<ImageResult> {
    const model = options?.model ?? 'imagen-3.0-generate-002'
    const body: Record<string, any> = {
      instances: [{ prompt }],
      parameters: { sampleCount: options?.n ?? 1 },
    }
    if (options?.size) body.parameters.aspectRatio = options.size

    const data = await this.post(`/models/${model}:predict`, body)
    return {
      images: (data.predictions ?? []).map((p: any) => ({
        b64Json: p.bytesBase64Encoded,
      })),
      model,
    }
  }

  async speak(_text: string, _options?: AudioSpeechOptions): Promise<Uint8Array> {
    throw new AIError('Gemini TTS is not yet supported via this driver.')
  }

  async transcribe(_audio: Uint8Array | string, _options?: AudioTranscribeOptions): Promise<TranscriptionResult> {
    throw new AIError('Use Gemini chat with audio content parts for transcription.')
  }

  async moderate(_input: string | string[], _options?: ModerationOptions): Promise<ModerationResult> {
    throw new AIError('Gemini does not expose a standalone moderation endpoint.')
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private buildBody(messages: ChatMessage[], options?: ChatOptions): Record<string, any> {
    const systemMessages = messages.filter((m) => m.role === 'system')
    const nonSystemMessages = messages.filter((m) => m.role !== 'system')

    const body: Record<string, any> = {
      contents: nonSystemMessages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: this.formatParts(m),
      })),
    }

    if (systemMessages.length > 0) {
      body.systemInstruction = {
        parts: [{ text: systemMessages.map((m) =>
          typeof m.content === 'string' ? m.content : ''
        ).join('\n\n') }],
      }
    }

    const generationConfig: Record<string, any> = {}
    if (options?.temperature !== undefined) generationConfig.temperature = options.temperature
    if (options?.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens
    if (options?.topP !== undefined) generationConfig.topP = options.topP
    if (options?.topK !== undefined) generationConfig.topK = options.topK
    if (options?.stop) generationConfig.stopSequences = options.stop

    if (options?.responseFormat === 'json') {
      generationConfig.responseMimeType = 'application/json'
    } else if (typeof options?.responseFormat === 'object' && options.responseFormat.type === 'json_schema') {
      generationConfig.responseMimeType = 'application/json'
      generationConfig.responseSchema = options.responseFormat.schema
    }

    if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig

    if (options?.tools?.length) {
      body.tools = [{
        functionDeclarations: options.tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        })),
      }]
    }

    return body
  }

  private formatParts(msg: ChatMessage): any[] {
    if (typeof msg.content === 'string') return [{ text: msg.content }]

    return msg.content.map((part) => {
      switch (part.type) {
        case 'text': return { text: part.text }
        case 'image_base64': return { inlineData: { mimeType: part.mimeType, data: part.imageBase64 } }
        case 'image_url': return { fileData: { mimeType: 'image/jpeg', fileUri: part.imageUrl } }
        case 'audio': return { inlineData: { mimeType: part.mimeType, data: part.audioBase64 } }
        case 'video': return part.videoBase64
          ? { inlineData: { mimeType: part.mimeType, data: part.videoBase64 } }
          : { fileData: { mimeType: part.mimeType, fileUri: part.videoUrl } }
        case 'file': return part.fileBase64
          ? { inlineData: { mimeType: part.mimeType, data: part.fileBase64 } }
          : { fileData: { mimeType: part.mimeType, fileUri: part.fileUrl } }
        default: return { text: JSON.stringify(part) }
      }
    })
  }

  private parseResponse(data: any, model: string): ChatResponse {
    const candidate = data.candidates?.[0]
    const parts = candidate?.content?.parts ?? []
    const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text)
    const functionParts = parts.filter((p: any) => p.functionCall)

    return {
      id: '',
      content: textParts.join(''),
      role: 'assistant',
      model,
      toolCalls: functionParts.map((p: any) => ({
        id: crypto.randomUUID(),
        type: 'function' as const,
        function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args) },
      })),
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
      },
      finishReason: functionParts.length > 0 ? 'tool_calls'
        : candidate?.finishReason === 'SAFETY' ? 'content_filter'
        : 'stop',
      raw: data,
    }
  }

  private async post(path: string, body: Record<string, any>): Promise<any> {
    const response = await fetch(`${this.baseUrl}${path}?key=${this.config.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new AIError(`Gemini API error: ${response.status}`, { status: response.status, body: errorBody })
    }

    return response.json()
  }
}
