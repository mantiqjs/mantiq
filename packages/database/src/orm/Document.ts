// @ts-nocheck — deprecated, replaced by Model with MongoDB connection
import type { MongoDatabaseConnection, MongoFilter, MongoUpdateDoc, MongoPipelineStage } from '../contracts/MongoConnection.ts'
import { ModelNotFoundError } from '../errors/ModelNotFoundError.ts'

/**
 * Base class for MongoDB document models. Similar to Model but for document databases.
 *
 * @example
 * class User extends Document {
 *   static collection = 'users'
 *   static connection = mongoConn
 *
 *   get fullName(): string {
 *     return `${this.get('firstName')} ${this.get('lastName')}`
 *   }
 * }
 *
 * const user = await User.findById('65a...')
 * await user!.update({ $set: { name: 'New Name' } })
 */
export abstract class Document {
  static connection: MongoDatabaseConnection | null = null
  static collection: string = ''
  static hidden: string[] = []

  protected _doc: Record<string, any> = {}
  protected _exists = false

  // ── Static query API ───────────────────────────────────────────────────────

  static col<T extends Document>(this: { new(): T } & typeof Document): import('../contracts/MongoConnection.ts').MongoCollectionContract {
    const ctor = this as unknown as typeof Document
    if (!ctor.connection) throw new Error(`No connection set on Document ${ctor.collection}`)
    return ctor.connection.collection(ctor.collection)
  }

  static async find<T extends Document>(this: { new(): T } & typeof Document, filter: MongoFilter = {}): Promise<T[]> {
    const rows = await (this as unknown as typeof Document).col<T>().find(filter).get()
    return rows.map((r) => (this as unknown as typeof Document).hydrate<T>(this, r))
  }

  static async findOne<T extends Document>(this: { new(): T } & typeof Document, filter: MongoFilter = {}): Promise<T | null> {
    const row = await (this as unknown as typeof Document).col<T>().findOne(filter)
    return row ? (this as unknown as typeof Document).hydrate<T>(this, row) : null
  }

  static async findById<T extends Document>(this: { new(): T } & typeof Document, id: any): Promise<T | null> {
    const row = await (this as unknown as typeof Document).col<T>().findById(id)
    return row ? (this as unknown as typeof Document).hydrate<T>(this, row) : null
  }

  static async findByIdOrFail<T extends Document>(this: { new(): T } & typeof Document, id: any): Promise<T> {
    const doc = await (this as unknown as typeof Document).findById<T>(id)
    if (!doc) throw new ModelNotFoundError((this as unknown as typeof Document).collection)
    return doc
  }

  static async create<T extends Document>(this: { new(): T } & typeof Document, data: Record<string, any>): Promise<T> {
    const col = (this as unknown as typeof Document).col<T>()
    const now = new Date()
    const doc = { ...data, createdAt: now, updatedAt: now }
    const result = await col.insertOne(doc)
    return (this as unknown as typeof Document).hydrate<T>(this, { ...doc, _id: result.insertedId })
  }

  static async insertMany<T extends Document>(
    this: { new(): T } & typeof Document,
    docs: Record<string, any>[],
  ): Promise<T[]> {
    const col = (this as unknown as typeof Document).col<T>()
    const now = new Date()
    const withTimestamps = docs.map((d) => ({ ...d, createdAt: now, updatedAt: now }))
    const result = await col.insertMany(withTimestamps)
    return withTimestamps.map((d, i) =>
      (this as unknown as typeof Document).hydrate<T>(this, { ...d, _id: result.insertedIds[i] }),
    )
  }

  static async updateOne<T extends Document>(
    this: { new(): T } & typeof Document,
    filter: MongoFilter,
    update: MongoUpdateDoc,
  ) {
    const merged: MongoUpdateDoc = {
      ...update,
      $set: { ...update.$set, updatedAt: new Date() },
    }
    return (this as unknown as typeof Document).col<T>().updateOne(filter, merged)
  }

  static async updateMany<T extends Document>(
    this: { new(): T } & typeof Document,
    filter: MongoFilter,
    update: MongoUpdateDoc,
  ) {
    const merged: MongoUpdateDoc = {
      ...update,
      $set: { ...update.$set, updatedAt: new Date() },
    }
    return (this as unknown as typeof Document).col<T>().updateMany(filter, merged)
  }

  static async deleteOne<T extends Document>(this: { new(): T } & typeof Document, filter: MongoFilter) {
    return (this as unknown as typeof Document).col<T>().deleteOne(filter)
  }

  static async deleteMany<T extends Document>(this: { new(): T } & typeof Document, filter: MongoFilter) {
    return (this as unknown as typeof Document).col<T>().deleteMany(filter)
  }

  static async aggregate<T extends Document>(
    this: { new(): T } & typeof Document,
    pipeline: MongoPipelineStage[],
  ): Promise<Record<string, any>[]> {
    return (this as unknown as typeof Document).col<T>().aggregate(pipeline)
  }

  static async count<T extends Document>(this: { new(): T } & typeof Document, filter: MongoFilter = {}): Promise<number> {
    return (this as unknown as typeof Document).col<T>().count(filter)
  }

  /** Set the MongoDB connection for this Document class */
  static setConnection(connection: MongoDatabaseConnection): void {
    this.connection = connection
  }

  // ── Instance methods ──────────────────────────────────────────────────────

  get(key: string): any {
    return this._doc[key]
  }

  set(key: string, value: any): this {
    this._doc[key] = value
    return this
  }

  getId(): any {
    return this._doc['_id']
  }

  toObject(): Record<string, any> {
    const ctor = this.constructor as typeof Document
    const obj: Record<string, any> = {}
    for (const [k, v] of Object.entries(this._doc)) {
      if (!ctor.hidden.includes(k)) obj[k] = v
    }
    return obj
  }

  toJSON(): Record<string, any> {
    return this.toObject()
  }

  async update(update: MongoUpdateDoc): Promise<this> {
    const ctor = this.constructor as typeof Document
    if (!ctor.connection || !this._exists) return this

    const merged: MongoUpdateDoc = {
      ...update,
      $set: { ...update.$set, updatedAt: new Date() },
    }

    await ctor.connection.collection(ctor.collection).updateOne({ _id: this.getId() }, merged)

    // Apply $set changes locally
    if (merged.$set) {
      for (const [k, v] of Object.entries(merged.$set)) {
        this._doc[k] = v
      }
    }

    return this
  }

  async delete(): Promise<boolean> {
    const ctor = this.constructor as typeof Document
    if (!ctor.connection || !this._exists) return false
    await ctor.connection.collection(ctor.collection).deleteOne({ _id: this.getId() })
    this._exists = false
    return true
  }

  async refresh(): Promise<this> {
    const ctor = this.constructor as typeof Document
    if (!ctor.connection) return this
    const row = await ctor.connection.collection(ctor.collection).findById(this.getId())
    if (row) this._doc = row
    return this
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private static hydrate<T extends Document>(
    ctor: new () => T,
    doc: Record<string, any>,
  ): T {
    const instance = new ctor()
    instance._doc = doc
    instance._exists = true
    return instance
  }
}
