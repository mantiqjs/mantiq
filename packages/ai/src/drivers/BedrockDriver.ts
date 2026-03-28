import type { AIDriver } from '../contracts/AIDriver.ts'
import type { ChatMessage, ChatOptions, ChatResponse, ChatChunk } from '../contracts/ChatMessage.ts'
import type { EmbedOptions, EmbeddingResult } from '../contracts/Embedding.ts'
import type { ImageGenerateOptions, ImageResult } from '../contracts/Image.ts'
import type { AudioSpeechOptions, AudioTranscribeOptions, TranscriptionResult } from '../contracts/Audio.ts'
import type { ModerationOptions, ModerationResult } from '../contracts/Moderation.ts'
import { AIError } from '../errors/AIError.ts'

export interface BedrockConfig {
  region: string
  accessKeyId?: string
  secretAccessKey?: string
  profile?: string
}

/**
 * AWS Bedrock driver — supports Claude, Titan, Llama, and other models
 * via the Bedrock Converse API.
 *
 * Uses AWS Signature V4 signing for authentication.
 */
export class BedrockDriver implements AIDriver {
  constructor(private config: BedrockConfig) {}

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const model = options?.model ?? 'anthropic.claude-sonnet-4-20250514-v1:0'
    const body = this.buildConverseBody(messages, options)
    const data = await this.invoke(`/model/${model}/converse`, body)

    return {
      id: data.$metadata?.requestId ?? crypto.randomUUID(),
      content: data.output?.message?.content?.map((b: any) => b.text).join('') ?? '',
      role: 'assistant',
      model,
      toolCalls: (data.output?.message?.content ?? [])
        .filter((b: any) => b.toolUse)
        .map((b: any) => ({
          id: b.toolUse.toolUseId,
          type: 'function' as const,
          function: { name: b.toolUse.name, arguments: JSON.stringify(b.toolUse.input) },
        })),
      usage: {
        promptTokens: data.usage?.inputTokens ?? 0,
        completionTokens: data.usage?.outputTokens ?? 0,
        totalTokens: (data.usage?.inputTokens ?? 0) + (data.usage?.outputTokens ?? 0),
      },
      finishReason: data.stopReason === 'tool_use' ? 'tool_calls' : 'stop',
      raw: data,
    }
  }

  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<ChatChunk> {
    const model = options?.model ?? 'anthropic.claude-sonnet-4-20250514-v1:0'
    const body = this.buildConverseBody(messages, options)
    const data = await this.invoke(`/model/${model}/converse-stream`, body)

    // Bedrock returns an event stream — parse it
    if (data.stream) {
      for await (const event of data.stream) {
        if (event.contentBlockDelta?.delta?.text) {
          yield { id: '', delta: event.contentBlockDelta.delta.text }
        }
        if (event.messageStop) {
          yield { id: '', delta: '', finishReason: 'stop' }
        }
      }
    }
  }

  async embed(input: string | string[], options?: EmbedOptions): Promise<EmbeddingResult> {
    const model = options?.model ?? 'amazon.titan-embed-text-v2:0'
    const inputs = Array.isArray(input) ? input : [input]
    const results: number[][] = []

    for (const text of inputs) {
      const body = { inputText: text }
      if (options?.dimensions) (body as any).dimensions = options.dimensions

      const data = await this.invoke(`/model/${model}/invoke`, body)
      results.push(data.embedding)
    }

    return {
      embeddings: results,
      model,
      usage: { totalTokens: 0 },
    }
  }

  async generateImage(prompt: string, options?: ImageGenerateOptions): Promise<ImageResult> {
    const model = options?.model ?? 'amazon.titan-image-generator-v2:0'
    const body = {
      textToImageParams: { text: prompt },
      imageGenerationConfig: {
        numberOfImages: options?.n ?? 1,
        quality: options?.quality ?? 'standard',
      },
    }

    const data = await this.invoke(`/model/${model}/invoke`, body)
    return {
      images: (data.images ?? []).map((b64: string) => ({ b64Json: b64 })),
      model,
    }
  }

  async speak(_text: string, _options?: AudioSpeechOptions): Promise<Uint8Array> {
    throw new AIError('Use AWS Polly for text-to-speech instead of Bedrock.')
  }

  async transcribe(_audio: Uint8Array | string, _options?: AudioTranscribeOptions): Promise<TranscriptionResult> {
    throw new AIError('Use AWS Transcribe for speech-to-text instead of Bedrock.')
  }

  async moderate(_input: string | string[], _options?: ModerationOptions): Promise<ModerationResult> {
    throw new AIError('Use AWS Comprehend for content moderation instead of Bedrock.')
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private buildConverseBody(messages: ChatMessage[], options?: ChatOptions): Record<string, any> {
    const systemMessages = messages.filter((m) => m.role === 'system')
    const nonSystemMessages = messages.filter((m) => m.role !== 'system')

    const body: Record<string, any> = {
      messages: nonSystemMessages.map((m) => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: typeof m.content === 'string'
          ? [{ text: m.content }]
          : m.content.map((p) => ('text' in p ? { text: p.text } : { text: JSON.stringify(p) })),
      })),
    }

    if (systemMessages.length > 0) {
      body.system = systemMessages.map((m) => ({
        text: typeof m.content === 'string' ? m.content : '',
      }))
    }

    const inferenceConfig: Record<string, any> = {}
    if (options?.maxTokens) inferenceConfig.maxTokens = options.maxTokens
    if (options?.temperature !== undefined) inferenceConfig.temperature = options.temperature
    if (options?.topP !== undefined) inferenceConfig.topP = options.topP
    if (options?.stop) inferenceConfig.stopSequences = options.stop
    if (Object.keys(inferenceConfig).length > 0) body.inferenceConfig = inferenceConfig

    if (options?.tools?.length) {
      body.toolConfig = {
        tools: options.tools.map((t) => ({
          toolSpec: {
            name: t.function.name,
            description: t.function.description,
            inputSchema: { json: t.function.parameters },
          },
        })),
      }
    }

    return body
  }

  private async invoke(path: string, body: Record<string, any>): Promise<any> {
    const url = `https://bedrock-runtime.${this.config.region}.amazonaws.com${path}`

    // AWS Signature V4 signing
    const headers = await this.signRequest('POST', url, JSON.stringify(body))

    const response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new AIError(`Bedrock API error: ${response.status}`, { status: response.status, body: errorBody })
    }

    return response.json()
  }

  private async signRequest(method: string, url: string, body: string): Promise<Record<string, string>> {
    // AWS Signature V4 implementation using crypto.subtle
    const accessKeyId = this.config.accessKeyId ?? process.env['AWS_ACCESS_KEY_ID'] ?? ''
    const secretAccessKey = this.config.secretAccessKey ?? process.env['AWS_SECRET_ACCESS_KEY'] ?? ''

    if (!accessKeyId || !secretAccessKey) {
      throw new AIError('AWS credentials not configured for Bedrock.')
    }

    const now = new Date()
    const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8)
    const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const parsedUrl = new URL(url)
    const service = 'bedrock'
    const credentialScope = `${dateStamp}/${this.config.region}/${service}/aws4_request`

    const encoder = new TextEncoder()

    const hmac = async (key: ArrayBuffer, data: string): Promise<ArrayBuffer> => {
      const keyData = new Uint8Array(key)
      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData.buffer as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
      )
      return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))
    }

    const hash = async (data: string): Promise<string> => {
      const buf = await crypto.subtle.digest('SHA-256', encoder.encode(data))
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
    }

    const payloadHash = await hash(body)
    const canonicalHeaders = `content-type:application/json\nhost:${parsedUrl.host}\nx-amz-date:${amzDate}\n`
    const signedHeaders = 'content-type;host;x-amz-date'
    const canonicalRequest = `${method}\n${parsedUrl.pathname}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await hash(canonicalRequest)}`

    let signingKey: ArrayBuffer = encoder.encode(`AWS4${secretAccessKey}`).buffer as ArrayBuffer
    for (const part of [dateStamp, this.config.region, service, 'aws4_request']) {
      signingKey = await hmac(signingKey, part)
    }

    const signatureBuf = await hmac(signingKey, stringToSign)
    const signature = [...new Uint8Array(signatureBuf)].map((b) => b.toString(16).padStart(2, '0')).join('')

    return {
      'X-Amz-Date': amzDate,
      'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    }
  }
}
