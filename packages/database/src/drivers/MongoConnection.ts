import type {
  MongoDatabaseConnection,
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
import { MongoQueryBuilderImpl } from './MongoQueryBuilderImpl.ts'
import { ConnectionError } from '../errors/ConnectionError.ts'
import { QueryError } from '../errors/QueryError.ts'

export interface MongoConfig {
  uri: string
  database: string
  options?: Record<string, any>
}

class MongoCollectionImpl implements MongoCollectionContract {
  constructor(
    private readonly col: any,
    private readonly name: string,
  ) {}

  find(filter: MongoFilter = {}): MongoQueryBuilder {
    return new MongoQueryBuilderImpl(
      this.name,
      async (opts) => {
        let cursor = this.col.find(opts.filter ?? {})
        if (opts.projection) cursor = cursor.project(opts.projection)
        if (opts.sort) cursor = cursor.sort(opts.sort)
        if (opts.skip) cursor = cursor.skip(opts.skip)
        if (opts.limit) cursor = cursor.limit(opts.limit)
        return cursor.toArray()
      },
      async (f) => this.col.countDocuments(f),
    )
  }

  async findOne(filter: MongoFilter = {}): Promise<Record<string, any> | null> {
    return this.col.findOne(filter)
  }

  async findById(id: any): Promise<Record<string, any> | null> {
    const { ObjectId } = await import('mongodb')
    return this.col.findOne({ _id: typeof id === 'string' ? new ObjectId(id) : id })
  }

  async insertOne(doc: Record<string, any>): Promise<MongoInsertResult> {
    const result = await this.col.insertOne(doc)
    return { insertedId: result.insertedId, acknowledged: result.acknowledged }
  }

  async insertMany(docs: Record<string, any>[]): Promise<MongoInsertManyResult> {
    const result = await this.col.insertMany(docs)
    return {
      insertedIds: Object.values(result.insertedIds),
      acknowledged: result.acknowledged,
      insertedCount: result.insertedCount,
    }
  }

  async updateOne(filter: MongoFilter, update: MongoUpdateDoc): Promise<MongoUpdateResult> {
    const result = await this.col.updateOne(filter, update)
    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, acknowledged: result.acknowledged }
  }

  async updateMany(filter: MongoFilter, update: MongoUpdateDoc): Promise<MongoUpdateResult> {
    const result = await this.col.updateMany(filter, update)
    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, acknowledged: result.acknowledged }
  }

  async replaceOne(filter: MongoFilter, replacement: Record<string, any>): Promise<MongoUpdateResult> {
    const result = await this.col.replaceOne(filter, replacement)
    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, acknowledged: result.acknowledged }
  }

  async upsert(filter: MongoFilter, update: MongoUpdateDoc): Promise<MongoUpdateResult> {
    const result = await this.col.updateOne(filter, update, { upsert: true })
    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, acknowledged: result.acknowledged }
  }

  async deleteOne(filter: MongoFilter): Promise<MongoDeleteResult> {
    const result = await this.col.deleteOne(filter)
    return { deletedCount: result.deletedCount, acknowledged: result.acknowledged }
  }

  async deleteMany(filter: MongoFilter): Promise<MongoDeleteResult> {
    const result = await this.col.deleteMany(filter)
    return { deletedCount: result.deletedCount, acknowledged: result.acknowledged }
  }

  async aggregate(pipeline: MongoPipelineStage[]): Promise<Record<string, any>[]> {
    return this.col.aggregate(pipeline).toArray()
  }

  async count(filter: MongoFilter = {}): Promise<number> {
    return this.col.countDocuments(filter)
  }

  async createIndex(spec: Record<string, any>, options?: Record<string, any>): Promise<string> {
    return this.col.createIndex(spec, options)
  }

  async drop(): Promise<boolean> {
    return this.col.drop()
  }
}

export class MongoConnection implements MongoDatabaseConnection {
  private client: any = null
  private db: any = null
  private config: MongoConfig

  constructor(config: MongoConfig) {
    this.config = config
  }

  private async getDb(): Promise<any> {
    if (!this.db) {
      try {
        const { MongoClient } = await import('mongodb')
        this.client = new MongoClient(this.config.uri, this.config.options ?? {})
        await this.client.connect()
        this.db = this.client.db(this.config.database)
      } catch (e: any) {
        throw new ConnectionError(`MongoDB connection failed: ${e.message}`, 'mongodb', e)
      }
    }
    return this.db
  }

  collection(name: string): MongoCollectionContract {
    // Lazily get collection — actual DB ops will connect
    const self = this
    const col = {
      async getCol() {
        const db = await self.getDb()
        return db.collection(name)
      },
    }

    // We need to return a proxy that defers the actual collection resolution
    return new LazyMongoCollection(name, async () => {
      const db = await self.getDb()
      return db.collection(name)
    })
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

  async transaction<T>(callback: (conn: MongoDatabaseConnection) => Promise<T>): Promise<T> {
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

  private async getClient(): Promise<any> {
    await this.getDb()
    return this.client
  }

  getDriverName(): string {
    return 'mongodb'
  }

  async disconnect(): Promise<void> {
    await this.client?.close()
    this.client = null
    this.db = null
  }
}

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
    const { ObjectId } = await import('mongodb')
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
