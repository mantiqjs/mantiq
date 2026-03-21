import { getSearchManager } from '../helpers/search.ts'

export class SearchDeleteIndexCommand {
  readonly name = 'search:delete-index'
  readonly description = 'Delete a search index'
  readonly usage = 'search:delete-index <name>'

  async handle(args: { positionals: string[] }, io: any): Promise<void> {
    const name = args.positionals[0]
    if (!name) {
      io.error('Please provide an index name: search:delete-index <name>')
      return
    }

    try {
      await getSearchManager().deleteIndex(name)
      io.success(`Index "${name}" deleted.`)
    } catch (err) {
      io.error(`Failed to delete index: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
