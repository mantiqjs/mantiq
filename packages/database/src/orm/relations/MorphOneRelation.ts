import type { Model, ModelStatic } from '../Model.ts'
import { ModelNotFoundError } from '../../errors/ModelNotFoundError.ts'

/**
 * A polymorphic one-to-one relationship.
 *
 * The related model has a `{name}_type` column storing the parent model class name
 * and a `{name}_id` column storing the parent model's primary key.
 *
 * @example
 *   class User extends Model {
 *     image() {
 *       return this.morphOne(Image, 'imageable')
 *     }
 *   }
 *   // Image table has `imageable_type` and `imageable_id` columns
 */
export class MorphOneRelation<T extends Model> {
  constructor(
    private readonly related: ModelStatic<T>,
    private readonly parentId: any,
    private readonly morphType: string,
    private readonly morphName: string,
  ) {}

  async get(): Promise<T | null> {
    return this.related
      .where(`${this.morphName}_type`, this.morphType)
      .where(`${this.morphName}_id`, this.parentId)
      .first()
  }

  async getOrFail(): Promise<T> {
    const result = await this.get()
    if (!result) throw new ModelNotFoundError((this.related as typeof Model).table)
    return result
  }
}
