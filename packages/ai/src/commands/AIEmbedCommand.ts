import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'
import { Application } from '@mantiq/core'
import { EmbeddingManager } from '../embeddings/EmbeddingManager.ts'

/**
 * Embed a file's content and output the embedding vector(s) as JSON.
 *
 * Usage: bun mantiq ai:embed <file> [--model=text-embedding-3-small] [--provider=openai] [--dimensions=256]
 */
export class AIEmbedCommand extends Command {
  override name = 'ai:embed'
  override description = 'Embed a file and output the vector(s) as JSON'
  override usage = 'ai:embed <file> [--model=<model>] [--provider=<name>] [--dimensions=<n>]'

  override async handle(args: ParsedArgs): Promise<number> {
    const filePath = args.args[0]
    if (!filePath) {
      this.io.error('Please provide a file path.')
      this.io.muted(`  Usage: ${this.usage}`)
      return 1
    }

    const model = args.flags['model'] as string | undefined
    const dimensions = args.flags['dimensions'] as string | undefined

    const file = Bun.file(filePath)
    if (!(await file.exists())) {
      this.io.error(`File not found: ${filePath}`)
      return 1
    }

    const content = await file.text()
    if (!content.trim()) {
      this.io.error('File is empty.')
      return 1
    }

    this.io.info(`Embedding ${filePath} (${content.length} chars)...`)

    const embeddings = Application.getInstance().make(EmbeddingManager)
    const opts: import('../contracts/Embedding.ts').EmbedOptions = {}
    if (model) opts.model = model
    if (dimensions) opts.dimensions = Number(dimensions)

    const result = await embeddings.embed(content, opts)

    this.io.success(`Model: ${result.model} | Tokens: ${result.usage.totalTokens} | Vectors: ${result.embeddings.length}`)
    this.io.line(JSON.stringify(result.embeddings, null, 2))

    return 0
  }
}
