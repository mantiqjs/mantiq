import { getSearchManager } from '../helpers/search.ts'

export class SearchIndexCommand {
  readonly name = 'search:index'
  readonly description = 'Create a search index'
  readonly usage = 'search:index <name>'

  async handle(args: { positionals: string[] }, io: any): Promise<void> {
    const name = args.positionals[0]
    if (!name) {
      io.error('Please provide an index name: search:index <name>')
      return
    }

    try {
      await getSearchManager().createIndex(name)
      io.success(`Index "${name}" created.`)
    } catch (err) {
      io.error(`Failed to create index: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
