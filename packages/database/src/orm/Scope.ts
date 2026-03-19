import type { ModelQueryBuilder } from './ModelQueryBuilder.ts'
import type { Model } from './Model.ts'

/**
 * Global query scope contract.
 *
 * Global scopes are automatically applied to every query for a model.
 * They can be removed at query time via `withoutGlobalScope()`.
 *
 * Laravel equivalent: `Illuminate\Database\Eloquent\Scope`
 *
 * @example
 *   class ActiveScope implements Scope {
 *     apply(builder: ModelQueryBuilder<any>, model: typeof Model): void {
 *       builder.where('is_active', true)
 *     }
 *   }
 *
 *   class User extends Model {
 *     static booted() {
 *       this.addGlobalScope('active', new ActiveScope())
 *     }
 *   }
 */
export interface Scope {
  apply(builder: ModelQueryBuilder<any>, model: typeof Model): void
}

/**
 * A closure-based scope for simple cases.
 * Wraps a callback in the Scope interface.
 */
export class ClosureScope implements Scope {
  constructor(private readonly callback: (builder: ModelQueryBuilder<any>, model: typeof Model) => void) {}

  apply(builder: ModelQueryBuilder<any>, model: typeof Model): void {
    this.callback(builder, model)
  }
}
