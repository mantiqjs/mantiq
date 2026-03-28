import type { AIDriver } from '../contracts/AIDriver.ts'
import type { ChatMessage, ChatOptions, ChatResponse, ChatChunk } from '../contracts/ChatMessage.ts'
import type { EmbedOptions, EmbeddingResult } from '../contracts/Embedding.ts'
import type { ImageGenerateOptions, ImageResult } from '../contracts/Image.ts'
import type { AudioSpeechOptions, AudioTranscribeOptions, TranscriptionResult } from '../contracts/Audio.ts'
import type { ModerationOptions, ModerationResult } from '../contracts/Moderation.ts'

/**
 * No-op AI driver. Returns empty responses without making any API calls.
 * Used as the default when no provider is configured.
 */
export class NullDriver implements AIDriver {
  async chat(_messages: ChatMessage[], _options?: ChatOptions): Promise<ChatResponse> {
    return {
      id: crypto.randomUUID(),
      content: '',
      role: 'assistant',
      model: 'null',
      toolCalls: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: 'stop',
      raw: null,
    }
  }

  async *stream(_messages: ChatMessage[], _options?: ChatOptions): AsyncIterable<ChatChunk> {
    // No chunks to yield
  }

  async embed(input: string | string[], _options?: EmbedOptions): Promise<EmbeddingResult> {
    const inputs = Array.isArray(input) ? input : [input]
    return {
      embeddings: inputs.map(() => []),
      model: 'null',
      usage: { totalTokens: 0 },
    }
  }

  async generateImage(_prompt: string, _options?: ImageGenerateOptions): Promise<ImageResult> {
    return { images: [], model: 'null' }
  }

  async speak(_text: string, _options?: AudioSpeechOptions): Promise<Uint8Array> {
    return new Uint8Array(0)
  }

  async transcribe(_audio: Uint8Array | string, _options?: AudioTranscribeOptions): Promise<TranscriptionResult> {
    return { text: '' }
  }

  async moderate(_input: string | string[], _options?: ModerationOptions): Promise<ModerationResult> {
    return { id: crypto.randomUUID(), results: [] }
  }
}
