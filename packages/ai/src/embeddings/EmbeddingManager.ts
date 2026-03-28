import type { AIManager } from '../AIManager.ts'
import type { EmbedOptions, EmbeddingResult } from '../contracts/Embedding.ts'

/**
 * Manages embedding generation across providers.
 *
 * @example
 *   const embeddings = new EmbeddingManager(ai())
 *   const result = await embeddings.embed('Hello world')
 *   const batch = await embeddings.embedBatch(['Hello', 'World'], { batchSize: 100 })
 */
export class EmbeddingManager {
  constructor(
    private manager: AIManager,
    private defaultProvider?: string,
    private defaultModel?: string,
  ) {}

  /** Generate embeddings for a single input or array. */
  async embed(input: string | string[], options?: EmbedOptions): Promise<EmbeddingResult> {
    const provider = this.defaultProvider
    const opts: EmbedOptions = { ...options }
    if (this.defaultModel && !opts.model) opts.model = this.defaultModel

    return this.manager.driver(provider).embed(input, opts)
  }

  /** Embed a large array in batches to avoid API limits. */
  async embedBatch(
    inputs: string[],
    options?: EmbedOptions & { batchSize?: number },
  ): Promise<EmbeddingResult> {
    const batchSize = options?.batchSize ?? 100
    const allEmbeddings: number[][] = []
    let totalTokens = 0
    let model = ''

    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize)
      const result = await this.embed(batch, options)
      allEmbeddings.push(...result.embeddings)
      totalTokens += result.usage.totalTokens
      model = result.model
    }

    return { embeddings: allEmbeddings, model, usage: { totalTokens } }
  }

  /** Calculate cosine similarity between two vectors. */
  similarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0

    let dot = 0, normA = 0, normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!
      normA += a[i]! * a[i]!
      normB += b[i]! * b[i]!
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB)
    return denom === 0 ? 0 : dot / denom
  }
}
