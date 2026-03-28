import type { VectorStore, VectorDocument, VectorSearchOptions, VectorSearchResult } from '../contracts/VectorStore.ts'

/**
 * Generic query executor interface.
 * Compatible with any PostgreSQL client that supports parameterized queries.
 */
export interface QueryExecutor {
  query(sql: string, params?: any[]): Promise<{ rows: any[] }>
}

export interface PgVectorStoreOptions {
  /** A query executor (e.g. a pg Pool or @mantiq/database connection). */
  executor: QueryExecutor
  /** Table name. Defaults to 'vector_documents'. */
  table?: string
  /** Vector dimensions. Defaults to 1536 (OpenAI ada-002). */
  dimensions?: number
}

/**
 * PostgreSQL + pgvector vector store.
 *
 * Stores embeddings in a `vector(N)` column and performs similarity search
 * using the `<=>` (cosine distance) operator.
 *
 * @example
 *   const store = new PgVectorStore({ executor: pool, dimensions: 1536 })
 *   await store.upsert([{ id: '1', content: 'Hello', embedding: [...], metadata: {} }])
 *   const results = await store.search(queryEmbedding, { limit: 5 })
 */
export class PgVectorStore implements VectorStore {
  private executor: QueryExecutor
  private table: string
  private dimensions: number
  private initialized = false

  constructor(options: PgVectorStoreOptions) {
    this.executor = options.executor
    this.table = options.table ?? 'vector_documents'
    this.dimensions = options.dimensions ?? 1536
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    await this.ensureTable()

    for (const doc of documents) {
      const embeddingStr = `[${doc.embedding.join(',')}]`
      await this.executor.query(
        `INSERT INTO ${this.table} (id, content, embedding, metadata)
         VALUES ($1, $2, $3::vector, $4::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           content = EXCLUDED.content,
           embedding = EXCLUDED.embedding,
           metadata = EXCLUDED.metadata`,
        [doc.id, doc.content, embeddingStr, JSON.stringify(doc.metadata)],
      )
    }
  }

  async search(embedding: number[], options?: VectorSearchOptions): Promise<VectorSearchResult[]> {
    await this.ensureTable()

    const limit = options?.limit ?? 10
    const embeddingStr = `[${embedding.join(',')}]`

    // Build WHERE clause for metadata filters
    const conditions: string[] = []
    const params: any[] = [embeddingStr, limit]
    let paramIndex = 3

    if (options?.filter) {
      for (const [key, value] of Object.entries(options.filter)) {
        conditions.push(`metadata->>$${paramIndex} = $${paramIndex + 1}`)
        params.push(key, String(value))
        paramIndex += 2
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await this.executor.query(
      `SELECT id, content, metadata, 1 - (embedding <=> $1::vector) AS score
       FROM ${this.table}
       ${whereClause}
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      params,
    )

    const minScore = options?.minScore ?? 0

    return rows
      .filter((row: any) => row.score >= minScore)
      .map((row: any) => ({
        id: row.id as string,
        content: row.content as string,
        score: Number(row.score),
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      }))
  }

  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    await this.ensureTable()

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
    await this.executor.query(
      `DELETE FROM ${this.table} WHERE id IN (${placeholders})`,
      ids,
    )
  }

  async count(): Promise<number> {
    await this.ensureTable()

    const { rows } = await this.executor.query(
      `SELECT COUNT(*)::int AS count FROM ${this.table}`,
    )
    return rows[0]?.count ?? 0
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private async ensureTable(): Promise<void> {
    if (this.initialized) return

    await this.executor.query('CREATE EXTENSION IF NOT EXISTS vector')
    await this.executor.query(
      `CREATE TABLE IF NOT EXISTS ${this.table} (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding vector(${this.dimensions}),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb
      )`,
    )

    this.initialized = true
  }
}
