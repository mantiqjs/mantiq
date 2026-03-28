import type { VectorStore, VectorDocument, VectorSearchOptions, VectorSearchResult } from '../contracts/VectorStore.ts'

/**
 * In-memory vector store using cosine similarity.
 * Suitable for development, testing, and small datasets.
 */
export class InMemoryVectorStore implements VectorStore {
  private documents = new Map<string, VectorDocument>()

  async upsert(documents: VectorDocument[]): Promise<void> {
    for (const doc of documents) {
      this.documents.set(doc.id, doc)
    }
  }

  async search(embedding: number[], options?: VectorSearchOptions): Promise<VectorSearchResult[]> {
    const limit = options?.limit ?? 10
    const minScore = options?.minScore ?? 0

    const results: VectorSearchResult[] = []

    for (const doc of this.documents.values()) {
      const score = this.cosineSimilarity(embedding, doc.embedding)
      if (score < minScore) continue

      // Apply metadata filters
      if (options?.filter) {
        let matches = true
        for (const [key, value] of Object.entries(options.filter)) {
          if (doc.metadata[key] !== value) {
            matches = false
            break
          }
        }
        if (!matches) continue
      }

      results.push({
        id: doc.id,
        content: doc.content,
        score,
        metadata: doc.metadata,
      })
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.documents.delete(id)
    }
  }

  async count(): Promise<number> {
    return this.documents.size
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!
      normA += a[i]! * a[i]!
      normB += b[i]! * b[i]!
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    return denominator === 0 ? 0 : dotProduct / denominator
  }
}
