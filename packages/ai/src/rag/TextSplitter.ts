export interface TextSplitterOptions {
  chunkSize?: number
  chunkOverlap?: number
  separator?: string
}

/**
 * Splits text into chunks for embedding and RAG pipelines.
 */
export class TextSplitter {
  private chunkSize: number
  private chunkOverlap: number
  private separator: string

  constructor(options?: TextSplitterOptions) {
    this.chunkSize = options?.chunkSize ?? 1000
    this.chunkOverlap = options?.chunkOverlap ?? 200
    this.separator = options?.separator ?? '\n\n'
  }

  /** Split text by separator with configurable chunk size and overlap. */
  split(text: string): string[] {
    const segments = text.split(this.separator).filter((s) => s.trim())
    return this.mergeSegments(segments)
  }

  /** Split by paragraph boundaries. */
  splitByParagraph(text: string): string[] {
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim())
    return this.mergeSegments(paragraphs)
  }

  /** Split by markdown headers (##, ###, etc.). */
  splitByMarkdownHeaders(text: string): string[] {
    const sections = text.split(/(?=^#{1,6}\s)/m).filter((s) => s.trim())
    return this.mergeSegments(sections)
  }

  /** Split by sentence boundaries. */
  splitBySentence(text: string): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text]
    return this.mergeSegments(sentences.map((s) => s.trim()))
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private mergeSegments(segments: string[]): string[] {
    const chunks: string[] = []
    let current = ''

    for (const segment of segments) {
      const candidate = current ? `${current}${this.separator}${segment}` : segment

      if (candidate.length > this.chunkSize && current) {
        chunks.push(current.trim())
        // Overlap: keep the end of the previous chunk
        if (this.chunkOverlap > 0 && current.length > this.chunkOverlap) {
          current = current.slice(-this.chunkOverlap) + this.separator + segment
        } else {
          current = segment
        }
      } else {
        current = candidate
      }
    }

    if (current.trim()) {
      chunks.push(current.trim())
    }

    return chunks
  }
}
