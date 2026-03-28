import type { Model, ModelStatic } from '../Model.ts'
import type { ModelQueryBuilder } from '../ModelQueryBuilder.ts'

/**
 * A polymorphic one-to-many relationship.
 *
 * The related model has a `{name}_type` column storing the parent model class name
 * and a `{name}_id` column storing the parent model's primary key.
 *
 * @example
 *   class Post extends Model {
 *     comments() {
 *       return this.morphMany(Comment, 'commentable')
 *     }
 *   }
 *   // Comment table has `commentable_type` and `commentable_id` columns
 */
export class MorphManyRelation<T extends Model> {
  constructor(
    private readonly related: ModelStatic<T>,
    private readonly parentId: any,
    private readonly morphType: string,
    private readonly morphName: string,
  ) {}

  query(): ModelQueryBuilder<T> {
    return this.related
      .where(`${this.morphName}_type`, this.morphType)
      .where(`${this.morphName}_id`, this.parentId)
  }

  async get(): Promise<T[]> {
    return this.query().get()
  }

  async create(data: Record<string, any>): Promise<T> {
    return this.related.create({
      ...data,
      [`${this.morphName}_type`]: this.morphType,
      [`${this.morphName}_id`]: this.parentId,
    })
  }
}
