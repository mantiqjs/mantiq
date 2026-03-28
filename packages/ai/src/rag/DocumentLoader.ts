export interface LoadedDocument {
  content: string
  metadata: Record<string, any>
}

/**
 * Loads documents from various file formats for RAG ingestion.
 */
export class DocumentLoader {
  /** Load a plain text file. */
  async loadText(path: string): Promise<LoadedDocument[]> {
    const file = Bun.file(path)
    const content = await file.text()
    return [{ content, metadata: { source: path, type: 'text' } }]
  }

  /** Load a markdown file, preserving structure. */
  async loadMarkdown(path: string): Promise<LoadedDocument[]> {
    const file = Bun.file(path)
    const content = await file.text()
    return [{ content, metadata: { source: path, type: 'markdown' } }]
  }

  /** Load a JSON file. */
  async loadJson(path: string, contentField?: string): Promise<LoadedDocument[]> {
    const file = Bun.file(path)
    const data = await file.json()

    if (Array.isArray(data)) {
      return data.map((item, i) => ({
        content: contentField ? String(item[contentField]) : JSON.stringify(item),
        metadata: { source: path, type: 'json', index: i },
      }))
    }

    return [{
      content: contentField ? String(data[contentField]) : JSON.stringify(data),
      metadata: { source: path, type: 'json' },
    }]
  }

  /** Load a CSV file. Returns one document per row. */
  async loadCsv(path: string, contentColumns?: string[]): Promise<LoadedDocument[]> {
    const file = Bun.file(path)
    const text = await file.text()
    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length < 2) return []

    const headers = lines[0]!.split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
    const docs: LoadedDocument[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]!.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
      const row: Record<string, string> = {}
      headers.forEach((h, j) => { row[h] = values[j] ?? '' })

      const content = contentColumns
        ? contentColumns.map((col) => row[col] ?? '').join(' ')
        : values.join(' ')

      docs.push({ content, metadata: { source: path, type: 'csv', row: i, ...row } })
    }

    return docs
  }

  /** Load raw content from a string. */
  fromString(content: string, metadata?: Record<string, any>): LoadedDocument[] {
    return [{ content, metadata: { source: 'string', type: 'text', ...metadata } }]
  }
}
