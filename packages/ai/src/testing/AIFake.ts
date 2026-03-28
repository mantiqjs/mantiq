import type { AIDriver } from '../contracts/AIDriver.ts'
import type { ChatMessage, ChatOptions, ChatResponse, ChatChunk } from '../contracts/ChatMessage.ts'
import type { EmbedOptions, EmbeddingResult } from '../contracts/Embedding.ts'
import type { ImageGenerateOptions, ImageResult } from '../contracts/Image.ts'
import type { AudioSpeechOptions, AudioTranscribeOptions, TranscriptionResult } from '../contracts/Audio.ts'
import type { ModerationOptions, ModerationResult } from '../contracts/Moderation.ts'

interface SentRequest {
  method: 'chat' | 'embed' | 'generateImage' | 'speak' | 'transcribe' | 'moderate'
  messages?: ChatMessage[]
  options?: any
  input?: any
}

/**
 * Fake AI driver for testing — records requests and returns canned responses.
 *
 * @example
 *   const fake = new AIFake()
 *   fake.respondWith({ content: 'Hello from fake!' })
 *
 *   // Use in tests...
 *   fake.assertSent(1)
 *   fake.assertModelUsed('gpt-4o')
 *   fake.assertSentWith((req) => req.messages?.some(m => m.content === 'test'))
 */
export class AIFake implements AIDriver {
  private _sent: SentRequest[] = []
  private _responses: Partial<ChatResponse>[] = []
  private _defaultResponse: Partial<ChatResponse> = {}
  private _embedResponse: EmbeddingResult | undefined
  private _imageResponse: ImageResult | undefined
  private _speechResponse: Uint8Array | undefined
  private _transcribeResponse: TranscriptionResult | undefined
  private _moderationResponse: ModerationResult | undefined
  private _responseIndex = 0

  // ── Configuration ─────────────────────────────────────────────────────

  /** Set the default chat response. */
  respondWith(response: Partial<ChatResponse>): void {
    this._defaultResponse = response
  }

  /** Set a sequence of responses (returned in order). */
  respondWithSequence(responses: Partial<ChatResponse>[]): void {
    this._responses = responses
    this._responseIndex = 0
  }

  /** Set the embedding response. */
  respondWithEmbedding(result: EmbeddingResult): void {
    this._embedResponse = result
  }

  /** Set the image generation response. */
  respondWithImage(result: ImageResult): void {
    this._imageResponse = result
  }

  /** Set the speech response. */
  respondWithSpeech(audio: Uint8Array): void {
    this._speechResponse = audio
  }

  /** Set the transcription response. */
  respondWithTranscription(result: TranscriptionResult): void {
    this._transcribeResponse = result
  }

  /** Set the moderation response. */
  respondWithModeration(result: ModerationResult): void {
    this._moderationResponse = result
  }

  // ── AIDriver Implementation ───────────────────────────────────────────

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    this._sent.push({ method: 'chat', messages: [...messages], options })
    return this.nextChatResponse()
  }

  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<ChatChunk> {
    this._sent.push({ method: 'chat', messages: [...messages], options })
    const response = this.nextChatResponse()
    const words = response.content.split(' ')
    for (const word of words) {
      yield { id: response.id, delta: word + ' ' }
    }
    yield { id: response.id, delta: '', finishReason: 'stop', usage: response.usage }
  }

  async embed(input: string | string[], options?: EmbedOptions): Promise<EmbeddingResult> {
    this._sent.push({ method: 'embed', input, options })
    if (this._embedResponse) return this._embedResponse

    const inputs = Array.isArray(input) ? input : [input]
    return {
      embeddings: inputs.map(() => Array.from({ length: 1536 }, () => Math.random() * 2 - 1)),
      model: 'fake-embedding',
      usage: { totalTokens: inputs.join(' ').split(' ').length },
    }
  }

  async generateImage(_prompt: string, options?: ImageGenerateOptions): Promise<ImageResult> {
    this._sent.push({ method: 'generateImage', input: _prompt, options })
    return this._imageResponse ?? { images: [], model: 'fake-image' }
  }

  async speak(text: string, options?: AudioSpeechOptions): Promise<Uint8Array> {
    this._sent.push({ method: 'speak', input: text, options })
    return this._speechResponse ?? new Uint8Array(0)
  }

  async transcribe(audio: Uint8Array | string, options?: AudioTranscribeOptions): Promise<TranscriptionResult> {
    this._sent.push({ method: 'transcribe', input: audio, options })
    return this._transcribeResponse ?? { text: '' }
  }

  async moderate(input: string | string[], options?: ModerationOptions): Promise<ModerationResult> {
    this._sent.push({ method: 'moderate', input, options })
    return this._moderationResponse ?? { id: 'fake', results: [] }
  }

  // ── Assertions ────────────────────────────────────────────────────────

  /** Assert that N requests were sent. */
  assertSent(count?: number): void {
    if (count !== undefined && this._sent.length !== count) {
      throw new Error(`Expected ${count} AI requests, but ${this._sent.length} were sent.`)
    }
    if (this._sent.length === 0) {
      throw new Error('Expected AI requests to be sent, but none were.')
    }
  }

  /** Assert that no requests were sent. */
  assertNotSent(): void {
    if (this._sent.length > 0) {
      throw new Error(`Expected no AI requests, but ${this._sent.length} were sent.`)
    }
  }

  /** Alias for assertNotSent(). */
  assertNothingSent(): void {
    this.assertNotSent()
  }

  /** Assert a specific model was used. */
  assertModelUsed(model: string): void {
    const used = this._sent.some((r) => r.options?.model === model)
    if (!used) {
      throw new Error(`Expected model "${model}" to be used, but it was not.`)
    }
  }

  /** Assert that a request matching the predicate was sent. */
  assertSentWith(predicate: (req: SentRequest) => boolean): void {
    const found = this._sent.some(predicate)
    if (!found) {
      throw new Error('No AI request matching the predicate was found.')
    }
  }

  /** Assert that a specific method was called. */
  assertMethodCalled(method: SentRequest['method'], count?: number): void {
    const calls = this._sent.filter((r) => r.method === method)
    if (count !== undefined && calls.length !== count) {
      throw new Error(`Expected ${count} "${method}" calls, but ${calls.length} were made.`)
    }
    if (calls.length === 0) {
      throw new Error(`Expected "${method}" to be called, but it was not.`)
    }
  }

  // ── Inspection ────────────────────────────────────────────────────────

  /** Get all sent requests. */
  sent(): SentRequest[] {
    return [...this._sent]
  }

  /** Get sent requests filtered by method. */
  sentFor(method: SentRequest['method']): SentRequest[] {
    return this._sent.filter((r) => r.method === method)
  }

  /** Reset all state. */
  reset(): void {
    this._sent = []
    this._responses = []
    this._defaultResponse = {}
    this._embedResponse = undefined
    this._imageResponse = undefined
    this._speechResponse = undefined
    this._transcribeResponse = undefined
    this._moderationResponse = undefined
    this._responseIndex = 0
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private nextChatResponse(): ChatResponse {
    let partial: Partial<ChatResponse>

    if (this._responses.length > 0) {
      partial = this._responses[this._responseIndex % this._responses.length]!
      this._responseIndex++
    } else {
      partial = this._defaultResponse
    }

    return {
      id: partial.id ?? crypto.randomUUID(),
      content: partial.content ?? '',
      role: 'assistant',
      model: partial.model ?? 'fake',
      toolCalls: partial.toolCalls ?? [],
      usage: partial.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: partial.finishReason ?? 'stop',
      raw: partial.raw ?? null,
    }
  }
}
