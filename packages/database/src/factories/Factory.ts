import type { Model, ModelStatic } from '../orm/Model.ts'

type DefinitionFn<T> = (index: number) => Record<string, any>
type AfterCreateFn<T extends Model> = (model: T) => Promise<void>

/**
 * Model factory for generating test data.
 *
 * @example
 * class UserFactory extends Factory<User> {
 *   protected model = User
 *   definition(index: number) {
 *     return {
 *       name: `User ${index}`,
 *       email: `user${index}@example.com`,
 *       role: 'user',
 *     }
 *   }
 * }
 *
 * const user = await new UserFactory().create()
 * const users = await new UserFactory().count(5).create()
 */
export abstract class Factory<T extends Model> {
  protected abstract model: ModelStatic<T>
  protected _count = 1
  protected _states: DefinitionFn<T>[] = []
  protected _afterCreate: AfterCreateFn<T>[] = []
  protected _sequence = 0

  abstract definition(index: number): Record<string, any>

  count(n: number): this {
    this._count = n
    return this
  }

  state(overrides: Partial<Record<string, any>> | DefinitionFn<T>): this {
    if (typeof overrides === 'function') {
      this._states.push(overrides)
    } else {
      this._states.push(() => overrides)
    }
    return this
  }

  afterCreate(fn: AfterCreateFn<T>): this {
    this._afterCreate.push(fn)
    return this
  }

  /** Make model instances (not persisted) */
  make(overrides?: Record<string, any>): T | T[] {
    const results: T[] = []
    for (let i = 0; i < this._count; i++) {
      const index = ++this._sequence
      const attrs = this.resolveAttributes(index, overrides)
      const instance = new (this.model as any)()
      instance.forceFill(attrs)
      results.push(instance)
    }
    return this._count === 1 ? results[0]! : results
  }

  /** Create and persist model instances */
  async create(overrides?: Record<string, any>): Promise<T | T[]> {
    const results: T[] = []
    for (let i = 0; i < this._count; i++) {
      const index = ++this._sequence
      const attrs = this.resolveAttributes(index, overrides)
      const model = await this.model.create(attrs)
      for (const fn of this._afterCreate) await fn(model)
      results.push(model)
    }
    return this._count === 1 ? results[0]! : results
  }

  /** Create and return raw attribute objects (not persisted) */
  raw(overrides?: Record<string, any>): Record<string, any> | Record<string, any>[] {
    const results: Record<string, any>[] = []
    for (let i = 0; i < this._count; i++) {
      const index = ++this._sequence
      results.push(this.resolveAttributes(index, overrides))
    }
    return this._count === 1 ? results[0]! : results
  }

  private resolveAttributes(index: number, overrides?: Record<string, any>): Record<string, any> {
    let attrs = this.definition(index)
    for (const stateFn of this._states) {
      attrs = { ...attrs, ...stateFn(index) }
    }
    if (overrides) attrs = { ...attrs, ...overrides }
    return attrs
  }
}
