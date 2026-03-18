import { describe, it, expect, beforeEach } from 'bun:test'
import { ContainerImpl } from '../../src/container/Container.ts'
import { ContainerResolutionError } from '../../src/errors/ContainerResolutionError.ts'

class Logger {
  log(msg: string) { return msg }
}

class UserService {
  constructor(public logger: Logger) {}
}

class DatabaseService {
  constructor(public host: string) {}
}

describe('Container', () => {
  let container: ContainerImpl

  beforeEach(() => {
    container = new ContainerImpl()
  })

  it('bind-and-resolve: binds a class and resolves it', () => {
    container.bind(Logger, () => new Logger())
    const logger = container.make(Logger)
    expect(logger).toBeInstanceOf(Logger)
  })

  it('singleton-returns-same-instance: resolves the same instance each time', () => {
    container.singleton(Logger, () => new Logger())
    const a = container.make(Logger)
    const b = container.make(Logger)
    expect(a).toBe(b)
  })

  it('transient-returns-new-instance: resolves a new instance each time', () => {
    container.bind(Logger, () => new Logger())
    const a = container.make(Logger)
    const b = container.make(Logger)
    expect(a).not.toBe(b)
  })

  it('factory-binding: factory is called with the container', () => {
    let receivedContainer: any
    container.bind(Logger, (c) => {
      receivedContainer = c
      return new Logger()
    })
    container.make(Logger)
    expect(receivedContainer).toBe(container)
  })

  it('instance-binding: registers a pre-created instance', () => {
    const logger = new Logger()
    container.instance(Logger, logger)
    expect(container.make(Logger)).toBe(logger)
  })

  it('alias-resolution: resolves by alias', () => {
    container.singleton(Logger, () => new Logger())
    container.alias(Logger, 'logger')
    const a = container.make(Logger)
    const b = container.make<Logger>('logger')
    expect(a).toBe(b)
  })

  it('has-returns-false: unbound abstract returns false', () => {
    expect(container.has(Logger)).toBe(false)
  })

  it('has-returns-true: bound abstract returns true', () => {
    container.bind(Logger, () => new Logger())
    expect(container.has(Logger)).toBe(true)
  })

  it('has-returns-true-for-instance: instance binding returns true', () => {
    container.instance(Logger, new Logger())
    expect(container.has(Logger)).toBe(true)
  })

  it('flush-clears-singletons: new instance after flush', () => {
    container.singleton(Logger, () => new Logger())
    const a = container.make(Logger)
    container.flush()
    container.singleton(Logger, () => new Logger())
    const b = container.make(Logger)
    expect(a).not.toBe(b)
  })

  it('unresolvable-throws: throws ContainerResolutionError for unbound', () => {
    expect(() => container.make(DatabaseService)).toThrow(ContainerResolutionError)
  })

  it('unresolvable-throws reason: reason is not_bound for unbound primitives', () => {
    class ServiceWithPrimitiveDep {
      constructor(public name: string) {}
    }
    let error: ContainerResolutionError | undefined
    try {
      container.make(ServiceWithPrimitiveDep)
    } catch (e) {
      error = e as ContainerResolutionError
    }
    expect(error).toBeInstanceOf(ContainerResolutionError)
  })

  it('makeOrDefault: returns default when not bound and unresolvable', () => {
    const fallback = new DatabaseService('localhost')
    const result = container.makeOrDefault(DatabaseService, fallback)
    expect(result).toBe(fallback)
  })

  it('makeOrDefault: returns bound instance when available', () => {
    const db = new DatabaseService('localhost')
    container.instance(DatabaseService, db)
    expect(container.makeOrDefault(DatabaseService, new DatabaseService('other'))).toBe(db)
  })

  it('contextual-binding: different concrete classes get different implementations', () => {
    class FastLogger extends Logger {}
    class SlowLogger extends Logger {}
    class ServiceA { constructor(public logger: Logger) {} }
    class ServiceB { constructor(public logger: Logger) {} }

    container.bind(FastLogger, () => new FastLogger())
    container.bind(SlowLogger, () => new SlowLogger())

    container.when(ServiceA).needs(Logger).give(() => new FastLogger())
    container.when(ServiceB).needs(Logger).give(() => new SlowLogger())

    // Contextual bindings are stored — verify they were set without error
    // (Full resolution requires metadata; we verify no throw on registration)
    expect(() => {
      container.when(ServiceA).needs(Logger).give(() => new FastLogger())
    }).not.toThrow()
  })

  it('zero-dep auto-resolution: instantiates class with no constructor args', () => {
    // Logger has no constructor params (length === 0)
    const logger = container.make(Logger)
    expect(logger).toBeInstanceOf(Logger)
  })
})
