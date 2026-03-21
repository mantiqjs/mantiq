import { getSearchManager } from '../helpers/search.ts'

export class MakeSearchableJob {
  readonly jobName = 'MakeSearchableJob'
  tries = 3
  backoff = 10

  constructor(
    private readonly models: any[],
    private readonly action: 'update' | 'delete',
  ) {}

  async handle(): Promise<void> {
    const engine = getSearchManager().driver()

    if (this.action === 'update') {
      await engine.update(this.models)
    } else {
      await engine.delete(this.models)
    }
  }
}
