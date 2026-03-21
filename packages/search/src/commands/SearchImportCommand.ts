import { getSearchManager } from '../helpers/search.ts'

export class SearchImportCommand {
  readonly name = 'search:import'
  readonly description = 'Import all records for a model into the search index'
  readonly usage = 'search:import <model>'

  async handle(args: { positionals: string[] }, io: any): Promise<void> {
    const modelName = args.positionals[0]
    if (!modelName) {
      io.error('Please provide a model name: search:import <model>')
      return
    }

    io.info(`Importing ${modelName}...`)

    try {
      const ModelClass = await this.resolveModel(modelName)
      if (typeof ModelClass.makeAllSearchable === 'function') {
        await ModelClass.makeAllSearchable()
        io.success(`All ${modelName} records have been imported.`)
      } else {
        io.error(`${modelName} is not searchable. Call makeSearchable() in its booted() method.`)
      }
    } catch (err) {
      io.error(`Failed to import: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  private async resolveModel(name: string): Promise<any> {
    // Try common model paths
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
    throw new Error(`Could not resolve model "${name}". Ensure it exists in app/Models/.`)
  }
}
