// ── Vector Store Contract ────────────────────────────────────────────────────

export interface VectorDocument {
  id: string
  content: string
  embedding: number[]
  metadata: Record<string, any>
}

export interface VectorSearchOptions {
  limit?: number
  minScore?: number
  filter?: Record<string, any>
}

export interface VectorSearchResult {
  id: string
  content: string
  score: number
  metadata: Record<string, any>
}

export interface VectorStore {
  upsert(documents: VectorDocument[]): Promise<void>
  search(embedding: number[], options?: VectorSearchOptions): Promise<VectorSearchResult[]>
  delete(ids: string[]): Promise<void>
  count(): Promise<number>
}

// ── Vector Store Config ──────────────────────────────────────────────────────

export type VectorStoreConfig =
  | { driver: 'memory' }
  | { driver: 'pgvector'; connection?: string; table?: string; dimensions?: number }
  | { driver: 'pinecone'; apiKey: string; environment: string; index: string }
  | { driver: 'qdrant'; url: string; apiKey?: string; collection: string }
  | { driver: 'weaviate'; url: string; apiKey?: string; className: string }
