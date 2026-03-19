// @mantiq/helpers — public API exports

// ── Laravel-equivalent utilities ─────────────────────────────────
export { Str, Stringable } from './Str.ts'
export { Arr } from './Arr.ts'
export { Num } from './Num.ts'
export { Collection, LazyCollection, collect, lazy, generate, range } from './Collection.ts'

// ── Beyond-Laravel utilities ─────────────────────────────────────
export { Result } from './Result.ts'
export type { Result as ResultType } from './Result.ts'
export { match } from './match.ts'
export { Duration } from './Duration.ts'
export { is } from './is.ts'

// ── HTTP client ──────────────────────────────────────────────────
export { Http, PendingRequest } from './Http.ts'
export type { HttpResponse, HttpError, HttpMiddleware, RetryConfig } from './Http.ts'
export { HttpFake } from './HttpFake.ts'
export type { StubResponse, StubHandler } from './HttpFake.ts'

// ── Async utilities ──────────────────────────────────────────────
export {
  parseDuration,
  sleep,
  retry,
  parallel,
  timeout,
  debounce,
  throttle,
  waterfall,
  defer,
} from './async.ts'

// ── Object utilities ─────────────────────────────────────────────
export {
  deepClone,
  deepMerge,
  deepFreeze,
  deepEqual,
  pick,
  omit,
  diff,
  mapValues,
  mapKeys,
  filterObject,
  invert,
  isPlainObject,
} from './objects.ts'

// ── Function utilities ───────────────────────────────────────────
export {
  tap,
  pipe,
  pipeline,
  compose,
  once,
  memoize,
  benchmark,
  noop,
  identity,
  constant,
  lazy as lazyValue,
  times,
} from './functions.ts'
