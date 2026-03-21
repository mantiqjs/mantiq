import type { DatabaseConnection } from '../contracts/Connection.ts'
import type { SchemaBuilder } from '../schema/SchemaBuilder.ts'
import type {
  MongoCollectionContract,
  MongoFilter,
  MongoUpdateDoc,
  MongoPipelineStage,
  MongoInsertResult,
  MongoInsertManyResult,
  MongoUpdateResult,
  MongoDeleteResult,
  MongoQueryBuilder,
} from '../contracts/MongoConnection.ts'
import type { QueryState, WhereClause } from '../query/Builder.ts'
import { QueryBuilder } from '../query/Builder.ts'
import { Expression } from '../query/Expression.ts'
import { MongoQueryBuilderImpl } from './MongoQueryBuilderImpl.ts'
import { ConnectionError } from '../errors/ConnectionError.ts'
import { DriverNotSupportedError } from '../errors/DriverNotSupportedError.ts'

export interface MongoConfig {
  uri: string
  database: string
  options?: Record<string, any> | undefined
}

// ── Operator translation map ──────────────────────────────────────────────────

const OPERATOR_MAP: Record<string, string> = {
  '=': '$eq',
  '!=': '$ne',
  '<>': '$ne',
  '>': '$gt',
  '>=': '$gte',
  '<': '$lt',
  '<=': '$lte',
}

// ── MongoConnection — implements the universal DatabaseConnection interface ──

export class MongoConnection implements DatabaseConnection {
  private client: any = null
  private db: any = null
  private config: MongoConfig

  constructor(config: MongoConfig) {
    this.config = config
  }

  private async getDb(): Promise<any> {
    if (!this.db) {
      try {
        const mongoModule = 'mongodb'
        const { MongoClient } = await import(/* webpackIgnore: true */ mongoModule)
        this.client = new MongoClient(this.config.uri, this.config.options ?? {})
        await this.client.connect()
        this.db = this.client.db(this.config.database)
      } catch (e: any) {
        throw new ConnectionError(`MongoDB connection failed: ${e.message}`, 'mongodb', e)
      }
    }
    return this.db
  }

  // ── Universal executeXxx methods ──────────────────────────────────────────

  async executeSelect(state: QueryState): Promise<Record<string, any>[]> {
    this.guardNoJoins(state)
    this.guardNoHavings(state)

    const db = await this.getDb()
    const col = db.collection(state.table)
    const filter = this.translateWheres(state.wheres)
    const projection = this.translateColumns(state.columns)
    const sort = this.translateOrders(state.orders)

    let cursor = col.find(filter)
    if (projection) cursor = cursor.project(projection)
    if (sort) cursor = cursor.sort(sort)
    if (state.offsetValue !== null) cursor = cursor.skip(state.offsetValue)
    if (state.limitValue !== null) cursor = cursor.limit(state.limitValue)

    return cursor.toArray()
  }

  async executeInsert(table: string, data: Record<string, any>): Promise<number> {
    const db = await this.getDb()
    const result = await db.collection(table).insertOne(data)
    return result.acknowledged ? 1 : 0
  }

  async executeInsertGetId(table: string, data: Record<string, any>): Promise<number | string> {
    const db = await this.getDb()
    const result = await db.collection(table).insertOne(data)
    const id = result.insertedId
    return typeof id === 'object' ? id.toString() : id
  }

  async executeUpdate(table: string, state: QueryState, data: Record<string, any>): Promise<number> {
    const db = await this.getDb()
    const filter = this.translateWheres(state.wheres)
    const result = await db.collection(table).updateMany(filter, { $set: data })
    return result.modifiedCount
  }

  async executeDelete(table: string, state: QueryState): Promise<number> {
    const db = await this.getDb()
    const filter = this.translateWheres(state.wheres)
    const result = await db.collection(table).deleteMany(filter)
    return result.deletedCount
  }

  async executeTruncate(table: string): Promise<void> {
    const db = await this.getDb()
    await db.collection(table).deleteMany({})
  }

  async executeAggregate(state: QueryState, fn: 'count' | 'sum' | 'avg' | 'min' | 'max', column: string): Promise<number> {
    const db = await this.getDb()
    const filter = this.translateWheres(state.wheres)

    if (fn === 'count') {
      return db.collection(state.table).countDocuments(filter)
    }

    const aggOp = `$${fn}`
    const aggField = column === '*' ? 1 : `$${column}`
    const pipeline: any[] = [
      { $match: filter },
      { $group: { _id: null, result: { [aggOp]: aggField } } },
    ]
    const [row] = await db.collection(state.table).aggregate(pipeline).toArray()
    return Number(row?.result ?? 0)
  }

  async executeExists(state: QueryState): Promise<boolean> {
    const db = await this.getDb()
    const filter = this.translateWheres(state.wheres)
    const count = await db.collection(state.table).countDocuments(filter, { limit: 1 })
    return count > 0
  }

  // ── Raw SQL methods — throw on MongoDB ────────────────────────────────────

  async select(sql: string, bindings?: any[]): Promise<Record<string, any>[]> {
    throw new DriverNotSupportedError('mongodb', 'raw SQL queries')
  }

  async statement(sql: string, bindings?: any[]): Promise<number> {
    throw new DriverNotSupportedError('mongodb', 'raw SQL queries')
  }

  async insertGetId(sql: string, bindings?: any[]): Promise<number | bigint | string> {
    throw new DriverNotSupportedError('mongodb', 'raw SQL queries')
  }

  // ── Shared interface ──────────────────────────────────────────────────────

  table(name: string): QueryBuilder {
    return new QueryBuilder(this, name)
  }

  schema(): SchemaBuilder {
    throw new DriverNotSupportedError('mongodb', 'schema builder (MongoDB is schemaless — use native() for indexes)')
  }

  async transaction<T>(callback: (conn: DatabaseConnection) => Promise<T>): Promise<T> {
    const client = await this.getClient()
    const session = client.startSession()
    try {
      let result!: T
      await session.withTransaction(async () => {
        const txConn = new MongoConnection(this.config)
        txConn.client = this.client
        txConn.db = this.db
        result = await callback(txConn)
      })
      return result
    } finally {
      await session.endSession()
    }
  }

  getDriverName(): string {
    return 'mongodb'
  }

  getTablePrefix(): string {
    return ''
  }

  // ── Native escape hatch — direct MongoDB access ───────────────────────────

  /** Returns the native MongoDB collection for advanced operations. */
  collection(name: string): MongoCollectionContract {
    return new LazyMongoCollection(name, async () => {
      const db = await this.getDb()
      return db.collection(name)
    })
  }

  /** Returns the underlying MongoDB Db instance. */
  async native(): Promise<any> {
    return this.getDb()
  }

  async command(command: Record<string, any>): Promise<any> {
    const db = await this.getDb()
    return db.command(command)
  }

  async listCollections(): Promise<string[]> {
    const db = await this.getDb()
    const collections = await db.listCollections().toArray()
    return collections.map((c: any) => c.name)
  }

  async disconnect(): Promise<void> {
    await this.client?.close()
    this.client = null
    this.db = null
  }

  private async getClient(): Promise<any> {
    await this.getDb()
    return this.client
  }

  // ── QueryState → MongoDB translation ──────────────────────────────────────

  private translateWheres(wheres: WhereClause[]): Record<string, any> {
    if (wheres.length === 0) return {}

    const andClauses: Record<string, any>[] = []
    const orGroups: Record<string, any>[][] = []
    let currentAnd: Record<string, any>[] = []

    for (const w of wheres) {
      const clause = this.translateSingleWhere(w)

      if (w.boolean === 'or' && currentAnd.length > 0) {
        // Push accumulated AND clauses as one OR branch
        orGroups.push(currentAnd)
        currentAnd = [clause]
      } else {
        currentAnd.push(clause)
      }
    }

    // Final group
    if (orGroups.length > 0) {
      orGroups.push(currentAnd)
      return { $or: orGroups.map((group) => group.length === 1 ? group[0]! : { $and: group }) }
    }

    if (currentAnd.length === 1) return currentAnd[0]!
    return { $and: currentAnd }
  }

  private translateSingleWhere(w: WhereClause): Record<string, any> {
    switch (w.type) {
      case 'basic': {
        const col = w.column!
        const op = w.operator ?? '='
        const val = w.value

        if (op === '=' || op === '$eq') {
          return { [col]: val }
        }

        if (op === 'like' || op === 'LIKE') {
          return { [col]: { $regex: this.likeToRegex(val), $options: 'i' } }
        }

        if (op === 'not like' || op === 'NOT LIKE') {
          return { [col]: { $not: { $regex: this.likeToRegex(val), $options: 'i' } } }
        }

        const mongoOp = OPERATOR_MAP[op]
        if (mongoOp) {
          return { [col]: { [mongoOp]: val } }
        }

        throw new DriverNotSupportedError('mongodb', `operator "${op}"`)
      }

      case 'in':
        return { [w.column!]: { $in: w.values! } }

      case 'notIn':
        return { [w.column!]: { $nin: w.values! } }

      case 'null':
        return { [w.column!]: null }

      case 'notNull':
        return { [w.column!]: { $ne: null } }

      case 'between':
        return { [w.column!]: { $gte: w.range![0], $lte: w.range![1] } }

      case 'nested':
        return this.translateWheres(w.nested ?? [])

      case 'raw':
        throw new DriverNotSupportedError('mongodb', 'whereRaw (use standard where methods instead)')

      case 'column':
        throw new DriverNotSupportedError('mongodb', 'whereColumn (use $expr in native queries instead)')

      default:
        throw new DriverNotSupportedError('mongodb', `where type "${w.type}"`)
    }
  }

  private translateColumns(columns: (string | Expression)[]): Record<string, 1> | undefined {
    if (columns.length === 1 && columns[0] === '*') return undefined
    if (columns.some((c) => c instanceof Expression)) {
      // Allow expressions only if they're simple strings (column names)
      // For actual SQL expressions, throw
      const hasRealExpressions = columns.some((c) => c instanceof Expression && (c.value.includes('(') || c.value.includes(' ')))
      if (hasRealExpressions) {
        throw new DriverNotSupportedError('mongodb', 'selectRaw with SQL expressions')
      }
    }

    const projection: Record<string, 1> = {}
    for (const col of columns) {
      const name = col instanceof Expression ? col.value : col
      projection[name] = 1
    }
    return projection
  }

  private translateOrders(orders: Array<{ column: string | Expression; direction: 'asc' | 'desc' }>): Record<string, 1 | -1> | undefined {
    if (orders.length === 0) return undefined
    const sort: Record<string, 1 | -1> = {}
    for (const o of orders) {
      if (o.column instanceof Expression) {
        throw new DriverNotSupportedError('mongodb', 'orderBy with raw Expression')
      }
      sort[o.column] = o.direction === 'asc' ? 1 : -1
    }
    return sort
  }

  /** Converts SQL LIKE pattern to regex: % → .*, _ → . */
  private likeToRegex(pattern: string): string {
    return pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/%/g, '.*')
      .replace(/_/g, '.')
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  private guardNoJoins(state: QueryState): void {
    if (state.joins.length > 0) {
      throw new DriverNotSupportedError('mongodb', 'joins (use relationships or native $lookup instead)')
    }
  }

  private guardNoHavings(state: QueryState): void {
    if (state.havings.length > 0) {
      throw new DriverNotSupportedError('mongodb', 'having (use native aggregation pipeline instead)')
    }
  }
}

// ── LazyMongoCollection — deferred collection resolution ────────────────────

class LazyMongoCollection implements MongoCollectionContract {
  private _col: any = null

  constructor(
    private readonly name: string,
    private readonly resolver: () => Promise<any>,
  ) {}

  private async col(): Promise<any> {
    if (!this._col) this._col = await this.resolver()
    return this._col
  }

  find(filter: MongoFilter = {}): MongoQueryBuilder {
    return new MongoQueryBuilderImpl(
      this.name,
      async (opts) => {
        const c = await this.col()
        let cursor = c.find(opts.filter ?? {})
        if (opts.projection) cursor = cursor.project(opts.projection)
        if (opts.sort) cursor = cursor.sort(opts.sort)
        if (opts.skip) cursor = cursor.skip(opts.skip)
        if (opts.limit) cursor = cursor.limit(opts.limit)
        return cursor.toArray()
      },
      async (f) => {
        const c = await this.col()
        return c.countDocuments(f)
      },
    )
  }

  async findOne(filter: MongoFilter = {}): Promise<Record<string, any> | null> {
    return (await this.col()).findOne(filter)
  }

  async findById(id: any): Promise<Record<string, any> | null> {
    const mongoModule = 'mongodb'
    const { ObjectId } = await import(/* webpackIgnore: true */ mongoModule)
    return (await this.col()).findOne({ _id: typeof id === 'string' ? new ObjectId(id) : id })
  }

  async insertOne(doc: Record<string, any>): Promise<MongoInsertResult> {
    const result = await (await this.col()).insertOne(doc)
    return { insertedId: result.insertedId, acknowledged: result.acknowledged }
  }

  async insertMany(docs: Record<string, any>[]): Promise<MongoInsertManyResult> {
    const result = await (await this.col()).insertMany(docs)
    return {
      insertedIds: Object.values(result.insertedIds),
      acknowledged: result.acknowledged,
      insertedCount: result.insertedCount,
    }
  }

  async updateOne(filter: MongoFilter, update: MongoUpdateDoc): Promise<MongoUpdateResult> {
    const result = await (await this.col()).updateOne(filter, update)
    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, acknowledged: result.acknowledged }
  }

  async updateMany(filter: MongoFilter, update: MongoUpdateDoc): Promise<MongoUpdateResult> {
    const result = await (await this.col()).updateMany(filter, update)
    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, acknowledged: result.acknowledged }
  }

  async replaceOne(filter: MongoFilter, replacement: Record<string, any>): Promise<MongoUpdateResult> {
    const result = await (await this.col()).replaceOne(filter, replacement)
    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, acknowledged: result.acknowledged }
  }

  async upsert(filter: MongoFilter, update: MongoUpdateDoc): Promise<MongoUpdateResult> {
    const result = await (await this.col()).updateOne(filter, update, { upsert: true })
    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, acknowledged: result.acknowledged }
  }

  async deleteOne(filter: MongoFilter): Promise<MongoDeleteResult> {
    const result = await (await this.col()).deleteOne(filter)
    return { deletedCount: result.deletedCount, acknowledged: result.acknowledged }
  }

  async deleteMany(filter: MongoFilter): Promise<MongoDeleteResult> {
    const result = await (await this.col()).deleteMany(filter)
    return { deletedCount: result.deletedCount, acknowledged: result.acknowledged }
  }

  async aggregate(pipeline: MongoPipelineStage[]): Promise<Record<string, any>[]> {
    return (await this.col()).aggregate(pipeline).toArray()
  }

  async count(filter: MongoFilter = {}): Promise<number> {
    return (await this.col()).countDocuments(filter)
  }

  async createIndex(spec: Record<string, any>, options?: Record<string, any>): Promise<string> {
    return (await this.col()).createIndex(spec, options)
  }

  async drop(): Promise<boolean> {
    return (await this.col()).drop()
  }
}
