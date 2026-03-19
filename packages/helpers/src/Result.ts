/**
 * Rust-inspired Result type for typed error handling.
 * Eliminates try/catch spaghetti with composable, type-safe operations.
 *
 * @example
 * ```ts
 * const result = Result.try(() => JSON.parse(input))
 * if (result.isOk()) {
 *   console.log(result.unwrap())
 * } else {
 *   console.error(result.unwrapErr())
 * }
 *
 * // Chainable
 * const name = await Result.tryAsync(() => fetchUser(id))
 *   .map(user => user.name)
 *   .unwrapOr('Anonymous')
 * ```
 */

export type Result<T, E = Error> = Ok<T, E> | Err<T, E>

class Ok<T, E> {
  readonly _tag = 'Ok' as const
  constructor(readonly value: T) {}

  isOk(): this is Ok<T, E> { return true }
  isErr(): this is Err<T, E> { return false }

  /** Get the value or throw */
  unwrap(): T { return this.value }

  /** Get the value or return the default */
  unwrapOr(_defaultValue: T): T { return this.value }

  /** Get the value or compute a default */
  unwrapOrElse(_fn: (error: E) => T): T { return this.value }

  /** Get the error — throws if Ok */
  unwrapErr(): never {
    throw new Error('Called unwrapErr() on an Ok value')
  }

  /** Transform the success value */
  map<U>(fn: (value: T) => U): Result<U, E> {
    return new Ok(fn(this.value))
  }

  /** Transform the error (no-op for Ok) */
  mapErr<F>(_fn: (error: E) => F): Result<T, F> {
    return new Ok(this.value)
  }

  /** Chain with another Result-returning function */
  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value)
  }

  /** Alias for flatMap */
  andThen<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value)
  }

  /** Return alternative if Err (no-op for Ok) */
  or(_result: Result<T, E>): Result<T, E> { return this }

  /** Return alternative computed if Err (no-op for Ok) */
  orElse(_fn: (error: E) => Result<T, E>): Result<T, E> { return this }

  /** Run a callback for Ok (for side effects, returns this) */
  tap(fn: (value: T) => void): Result<T, E> {
    fn(this.value)
    return this
  }

  /** Match Ok/Err with callbacks */
  match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
    return handlers.ok(this.value)
  }

  /** Convert to a plain object */
  toJSON(): { ok: true; value: T } {
    return { ok: true, value: this.value }
  }
}

class Err<T, E> {
  readonly _tag = 'Err' as const
  constructor(readonly error: E) {}

  isOk(): this is Ok<T, E> { return false }
  isErr(): this is Err<T, E> { return true }

  unwrap(): never {
    throw this.error instanceof Error ? this.error : new Error(String(this.error))
  }

  unwrapOr(defaultValue: T): T { return defaultValue }

  unwrapOrElse(fn: (error: E) => T): T { return fn(this.error) }

  unwrapErr(): E { return this.error }

  map<U>(_fn: (value: T) => U): Result<U, E> {
    return new Err(this.error)
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return new Err(fn(this.error))
  }

  flatMap<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return new Err(this.error)
  }

  andThen<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return new Err(this.error)
  }

  or(result: Result<T, E>): Result<T, E> { return result }

  orElse(fn: (error: E) => Result<T, E>): Result<T, E> { return fn(this.error) }

  tap(_fn: (value: T) => void): Result<T, E> { return this }

  match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
    return handlers.err(this.error)
  }

  toJSON(): { ok: false; error: E } {
    return { ok: false, error: this.error }
  }
}

// ── Factory functions ─────────────────────────────────────────────

export const Result = {
  /** Create a successful Result */
  ok<T, E = Error>(value: T): Result<T, E> {
    return new Ok(value)
  },

  /** Create a failed Result */
  err<T, E = Error>(error: E): Result<T, E> {
    return new Err(error)
  },

  /** Wrap a synchronous function call in a Result */
  try<T>(fn: () => T): Result<T, Error> {
    try {
      return new Ok(fn())
    } catch (e) {
      return new Err(e instanceof Error ? e : new Error(String(e)))
    }
  },

  /** Wrap an async function call in a Result */
  async tryAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
    try {
      return new Ok(await fn())
    } catch (e) {
      return new Err(e instanceof Error ? e : new Error(String(e)))
    }
  },

  /** Collect an array of Results into a Result of an array */
  all<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = []
    for (const result of results) {
      if (result.isErr()) return new Err(result.error)
      values.push(result.value)
    }
    return new Ok(values)
  },

  /** Return the first Ok, or the last Err */
  any<T, E>(results: Result<T, E>[]): Result<T, E> {
    let lastErr: Err<T, E> | null = null
    for (const result of results) {
      if (result.isOk()) return result
      lastErr = result as Err<T, E>
    }
    return lastErr ?? new Err(new Error('No results') as unknown as E)
  },

  /** Partition results into [ok values, err values] */
  partition<T, E>(results: Result<T, E>[]): [T[], E[]] {
    const oks: T[] = []
    const errs: E[] = []
    for (const result of results) {
      if (result.isOk()) oks.push(result.value)
      else errs.push(result.error)
    }
    return [oks, errs]
  },
}
