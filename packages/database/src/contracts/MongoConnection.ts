export interface MongoFilter {
  [key: string]: any
}

export interface MongoProjection {
  [key: string]: 0 | 1
}

export interface MongoUpdateDoc {
  $set?: Record<string, any>
  $unset?: Record<string, any>
  $inc?: Record<string, any>
  $push?: Record<string, any>
  $pull?: Record<string, any>
  $addToSet?: Record<string, any>
  [key: string]: any
}

export interface MongoSortDoc {
  [key: string]: 1 | -1
}

export interface MongoPipelineStage {
  $match?: MongoFilter
  $project?: MongoProjection
  $sort?: MongoSortDoc
  $limit?: number
  $skip?: number
  $group?: Record<string, any>
  $lookup?: Record<string, any>
  $unwind?: string | Record<string, any>
  $addFields?: Record<string, any>
  [key: string]: any
}

export interface MongoInsertResult {
  insertedId: any
  acknowledged: boolean
}

export interface MongoInsertManyResult {
  insertedIds: any[]
  acknowledged: boolean
  insertedCount: number
}

export interface MongoUpdateResult {
  matchedCount: number
  modifiedCount: number
  acknowledged: boolean
}

export interface MongoDeleteResult {
  deletedCount: number
  acknowledged: boolean
}

export interface MongoCollectionContract {
  /** Find documents matching filter */
  find(filter?: MongoFilter): MongoQueryBuilder
  /** Find a single document */
  findOne(filter?: MongoFilter): Promise<Record<string, any> | null>
  /** Find by _id */
  findById(id: any): Promise<Record<string, any> | null>
  /** Insert a single document */
  insertOne(doc: Record<string, any>): Promise<MongoInsertResult>
  /** Insert multiple documents */
  insertMany(docs: Record<string, any>[]): Promise<MongoInsertManyResult>
  /** Update first matching document */
  updateOne(filter: MongoFilter, update: MongoUpdateDoc): Promise<MongoUpdateResult>
  /** Update all matching documents */
  updateMany(filter: MongoFilter, update: MongoUpdateDoc): Promise<MongoUpdateResult>
  /** Replace a document by _id */
  replaceOne(filter: MongoFilter, replacement: Record<string, any>): Promise<MongoUpdateResult>
  /** Upsert: update or insert */
  upsert(filter: MongoFilter, update: MongoUpdateDoc): Promise<MongoUpdateResult>
  /** Delete first matching document */
  deleteOne(filter: MongoFilter): Promise<MongoDeleteResult>
  /** Delete all matching documents */
  deleteMany(filter: MongoFilter): Promise<MongoDeleteResult>
  /** Run an aggregation pipeline */
  aggregate(pipeline: MongoPipelineStage[]): Promise<Record<string, any>[]>
  /** Count documents */
  count(filter?: MongoFilter): Promise<number>
  /** Create an index */
  createIndex(spec: Record<string, any>, options?: Record<string, any>): Promise<string>
  /** Drop the collection */
  drop(): Promise<boolean>
}

export interface MongoQueryBuilder {
  /** Filter documents */
  where(filter: MongoFilter): MongoQueryBuilder
  /** Projection — include/exclude fields */
  select(projection: MongoProjection): MongoQueryBuilder
  /** Sort results */
  sort(sort: MongoSortDoc): MongoQueryBuilder
  /** Limit results */
  limit(n: number): MongoQueryBuilder
  /** Skip results */
  skip(n: number): MongoQueryBuilder
  /** Execute and return all results */
  get(): Promise<Record<string, any>[]>
  /** Execute and return first result */
  first(): Promise<Record<string, any> | null>
  /** Execute and return first or throw */
  firstOrFail(): Promise<Record<string, any>>
  /** Count matching documents */
  count(): Promise<number>
}

export interface MongoDatabaseConnection {
  /** Get a collection query interface */
  collection(name: string): MongoCollectionContract
  /** Run a raw command */
  command(command: Record<string, any>): Promise<any>
  /** List all collection names */
  listCollections(): Promise<string[]>
  /** Start a transaction session */
  transaction<T>(callback: (conn: MongoDatabaseConnection) => Promise<T>): Promise<T>
  getDriverName(): string
}
