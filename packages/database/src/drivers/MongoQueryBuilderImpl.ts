import type {
  MongoFilter,
  MongoProjection,
  MongoSortDoc,
  MongoQueryBuilder,
} from '../contracts/MongoConnection.ts'
import { ModelNotFoundError } from '../errors/ModelNotFoundError.ts'

export class MongoQueryBuilderImpl implements MongoQueryBuilder {
  private _filter: MongoFilter = {}
  private _projection: MongoProjection | undefined
  private _sort: MongoSortDoc | undefined
  private _limit: number | undefined
  private _skip: number | undefined

  constructor(
    private readonly collectionName: string,
    private readonly executor: (opts: {
      filter: MongoFilter
      projection?: MongoProjection
      sort?: MongoSortDoc
      limit?: number
      skip?: number
    }) => Promise<Record<string, any>[]>,
    private readonly counter: (filter: MongoFilter) => Promise<number>,
  ) {}

  where(filter: MongoFilter): this {
    this._filter = { ...this._filter, ...filter }
    return this
  }

  select(projection: MongoProjection): this {
    this._projection = projection
    return this
  }

  sort(sort: MongoSortDoc): this {
    this._sort = sort
    return this
  }

  limit(n: number): this {
    this._limit = n
    return this
  }

  skip(n: number): this {
    this._skip = n
    return this
  }

  async get(): Promise<Record<string, any>[]> {
    return this.executor({
      filter: this._filter,
      projection: this._projection,
      sort: this._sort,
      limit: this._limit,
      skip: this._skip,
    })
  }

  async first(): Promise<Record<string, any> | null> {
    const results = await this.limit(1).get()
    return results[0] ?? null
  }

  async firstOrFail(): Promise<Record<string, any>> {
    const row = await this.first()
    if (!row) throw new ModelNotFoundError(this.collectionName)
    return row
  }

  async count(): Promise<number> {
    return this.counter(this._filter)
  }
}
