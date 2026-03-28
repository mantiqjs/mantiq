export interface EmbedOptions {
  model?: string
  dimensions?: number
  encodingFormat?: 'float' | 'base64'
}

export interface EmbeddingResult {
  embeddings: number[][]
  model: string
  usage: { totalTokens: number }
}
