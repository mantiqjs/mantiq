import { gate } from './helpers/gate.ts'

/**
 * Mixin that adds `can()` / `cannot()` to model instances.
 *
 * Apply to any model class to allow authorization checks directly
 * on the model instance:
 *
 * @example
 * applyAuthorizable(User)
 * const user = await User.find(1)
 * if (await user.can('edit', post)) { ... }
 */
export function applyAuthorizable(ModelClass: any): void {
  ModelClass.prototype.can = async function (ability: string, ...args: any[]): Promise<boolean> {
    return gate().allows(ability, this, ...args)
  }

  ModelClass.prototype.cannot = async function (ability: string, ...args: any[]): Promise<boolean> {
    return gate().denies(ability, this, ...args)
  }
}
