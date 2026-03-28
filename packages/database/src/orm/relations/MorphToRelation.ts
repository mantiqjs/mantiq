import type { Model, ModelStatic } from '../Model.ts'
import { ModelNotFoundError } from '../../errors/ModelNotFoundError.ts'

/**
 * A polymorphic inverse relationship (the "child" side).
 *
 * Resolves the parent model using the `{name}_type` and `{name}_id` columns
 * on the current model.
 *
 * @example
 *   class Comment extends Model {
 *     commentable() {
 *       return this.morphTo()
 *     }
 *   }
 *   // Comment table has `commentable_type` and `commentable_id` columns
 *   // commentable_type stores the parent model class name (e.g. 'Post', 'Video')
 */
export class MorphToRelation<T extends Model> {
  constructor(
    private readonly morphType: string,
    private readonly morphId: any,
    private readonly ownerKey: string,
    private readonly morphMap: Record<string, ModelStatic<any>>,
  ) {}

  async get(): Promise<T | null> {
    if (this.morphType == null || this.morphId == null) return null

    const ModelClass = this.morphMap[this.morphType]
    if (!ModelClass) return null

    return ModelClass.where(this.ownerKey, this.morphId).first() as Promise<T | null>
  }

  async getOrFail(): Promise<T> {
    const result = await this.get()
    if (!result) throw new ModelNotFoundError(this.morphType)
    return result
  }
}
