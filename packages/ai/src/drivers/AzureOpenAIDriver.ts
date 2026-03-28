import type { AIDriver } from '../contracts/AIDriver.ts'
import type { ChatMessage, ChatOptions, ChatResponse, ChatChunk } from '../contracts/ChatMessage.ts'
import type { EmbedOptions, EmbeddingResult } from '../contracts/Embedding.ts'
import type { ImageGenerateOptions, ImageResult } from '../contracts/Image.ts'
import type { AudioSpeechOptions, AudioTranscribeOptions, TranscriptionResult } from '../contracts/Audio.ts'
import type { ModerationOptions, ModerationResult } from '../contracts/Moderation.ts'
import { OpenAIDriver } from './OpenAIDriver.ts'
import { AIError } from '../errors/AIError.ts'

export interface AzureOpenAIConfig {
  apiKey: string
  endpoint: string
  deploymentId: string
  apiVersion?: string
}

/**
 * Azure OpenAI driver — OpenAI-compatible API with Azure-specific routing.
 * Delegates to OpenAIDriver with a custom base URL and auth header.
 */
export class AzureOpenAIDriver implements AIDriver {
  private delegate: OpenAIDriver
  private endpoint: string
  private deploymentId: string
  private apiKey: string
  private apiVersion: string

  constructor(config: AzureOpenAIConfig) {
    this.endpoint = config.endpoint.replace(/\/$/, '')
    this.deploymentId = config.deploymentId
    this.apiKey = config.apiKey
    this.apiVersion = config.apiVersion ?? '2024-10-21'

    // Azure uses a different URL scheme: {endpoint}/openai/deployments/{deployment}/
    this.delegate = new OpenAIDriver({
      apiKey: config.apiKey,
      baseUrl: `${this.endpoint}/openai/deployments/${this.deploymentId}`,
    })
  }

  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    return this.delegate.chat(messages, { ...options, model: options?.model ?? this.deploymentId })
  }

  stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<ChatChunk> {
    return this.delegate.stream(messages, { ...options, model: options?.model ?? this.deploymentId })
  }

  embed(input: string | string[], options?: EmbedOptions): Promise<EmbeddingResult> {
    return this.delegate.embed(input, options)
  }

  generateImage(prompt: string, options?: ImageGenerateOptions): Promise<ImageResult> {
    return this.delegate.generateImage(prompt, options)
  }

  speak(text: string, options?: AudioSpeechOptions): Promise<Uint8Array> {
    return this.delegate.speak(text, options)
  }

  transcribe(audio: Uint8Array | string, options?: AudioTranscribeOptions): Promise<TranscriptionResult> {
    return this.delegate.transcribe(audio, options)
  }

  async moderate(_input: string | string[], _options?: ModerationOptions): Promise<ModerationResult> {
    throw new AIError('Azure OpenAI moderation uses Content Safety API. Configure separately.')
  }
}
