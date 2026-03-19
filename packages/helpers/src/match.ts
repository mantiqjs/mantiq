/**
 * Functional pattern matching — an expressive alternative to switch/if-else chains.
 *
 * @example
 * ```ts
 * const label = match(statusCode)
 *   .when(200, 'OK')
 *   .when(404, 'Not Found')
 *   .when((code) => code >= 500, 'Server Error')
 *   .otherwise('Unknown')
 *
 * const result = match(user.role)
 *   .when('admin', () => getAdminDashboard())
 *   .when('editor', () => getEditorPanel())
 *   .when(['viewer', 'guest'], () => getPublicView())
 *   .otherwise(() => redirect('/login'))
 * ```
 */

type MatchPredicate<T> = T | T[] | ((value: T) => boolean)
type MatchResult<R> = R | (() => R)

interface MatchBuilder<T, R = never> {
  /** Match against a value, array of values, or predicate function */
  when<U>(predicate: MatchPredicate<T>, result: MatchResult<U>): MatchBuilder<T, R | U>
  /** Provide a default value if nothing matched */
  otherwise<U>(result: MatchResult<U>): R | U
  /** Execute without a default — throws if nothing matched */
  exhaustive(): R
}

class MatchImpl<T, R> implements MatchBuilder<T, R> {
  private arms: Array<{ predicate: MatchPredicate<T>; result: MatchResult<any> }> = []
  private matched = false
  private matchedResult: any = undefined

  constructor(private readonly value: T) {}

  when<U>(predicate: MatchPredicate<T>, result: MatchResult<U>): MatchBuilder<T, R | U> {
    if (this.matched) return this as any

    if (this.test(predicate)) {
      this.matched = true
      this.matchedResult = typeof result === 'function' ? (result as () => U)() : result
    } else {
      this.arms.push({ predicate, result })
    }

    return this as any
  }

  otherwise<U>(result: MatchResult<U>): R | U {
    if (this.matched) return this.matchedResult
    return typeof result === 'function' ? (result as () => U)() : result
  }

  exhaustive(): R {
    if (this.matched) return this.matchedResult
    throw new Error(`No match found for value: ${JSON.stringify(this.value)}`)
  }

  private test(predicate: MatchPredicate<T>): boolean {
    if (typeof predicate === 'function') {
      return (predicate as (value: T) => boolean)(this.value)
    }
    if (Array.isArray(predicate)) {
      return predicate.includes(this.value)
    }
    return Object.is(this.value, predicate)
  }
}

/**
 * Start a pattern match on a value.
 */
export function match<T>(value: T): MatchBuilder<T> {
  return new MatchImpl(value)
}
