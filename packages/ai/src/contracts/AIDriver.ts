import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ChatChunk,
} from './ChatMessage.ts'
import type { EmbedOptions, EmbeddingResult } from './Embedding.ts'
import type { ImageGenerateOptions, ImageResult } from './Image.ts'
import type { AudioSpeechOptions, AudioTranscribeOptions, TranscriptionResult } from './Audio.ts'
import type { ModerationOptions, ModerationResult } from './Moderation.ts'

/**
 * Core AI driver contract.
 *
 * Every provider implements this interface. Methods that the provider
 * does not support should throw `AIError` with a clear message.
 */
export interface AIDriver {
  // ── Text Generation ──────────────────────────────────────────────────────

  /** Send a chat completion request. */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>

  /** Stream a chat completion response. */
  stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<ChatChunk>

  // ── Embeddings ─────────────────────────────────────────────────────────

  /** Generate embeddings for one or more inputs. */
  embed(input: string | string[], options?: EmbedOptions): Promise<EmbeddingResult>

  // ── Image Generation ───────────────────────────────────────────────────

  /** Generate images from a text prompt. */
  generateImage(prompt: string, options?: ImageGenerateOptions): Promise<ImageResult>

  // ── Audio ──────────────────────────────────────────────────────────────

  /** Text-to-speech: convert text to audio. */
  speak(text: string, options?: AudioSpeechOptions): Promise<Uint8Array>

  /** Speech-to-text: transcribe audio to text. */
  transcribe(audio: Uint8Array | string, options?: AudioTranscribeOptions): Promise<TranscriptionResult>

  // ── Moderation ─────────────────────────────────────────────────────────

  /** Check content against safety policies. */
  moderate(input: string | string[], options?: ModerationOptions): Promise<ModerationResult>
}
