import { getSearchManager } from '../helpers/search.ts'

export class SearchFlushCommand {
  readonly name = 'search:flush'
  readonly description = 'Remove all records for a model from the search index'
  readonly usage = 'search:flush <model>'

  async handle(args: { positionals: string[] }, io: any): Promise<void> {
    const modelName = args.positionals[0]
    if (!modelName) {
      io.error('Please provide a model name: search:flush <model>')
      return
    }

    io.info(`Flushing ${modelName} from search index...`)

    try {
      const ModelClass = await this.resolveModel(modelName)
      if (typeof ModelClass.removeAllFromSearch === 'function') {
        await ModelClass.removeAllFromSearch()
        io.success(`All ${modelName} records have been removed from the search index.`)
      } else {
        io.error(`${modelName} is not searchable. Call makeSearchable() in its booted() method.`)
      }
    } catch (err) {
      io.error(`Failed to flush: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  private async resolveModel(name: string): Promise<any> {
    const paths = [
      `../../app/Models/${name}.ts`,
      `../../Models/${name}.ts`,
      `../../app/Models/${name}`,
    ]
    for (const p of paths) {
      try {
        const mod = await import(p)
        return mod[name] ?? mod.default
      } catch { /* try next */ }
    }
    throw new Error(`Could not resolve model "${name}".`)
  }
}
