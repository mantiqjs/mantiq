import type { Bindable, Container, Constructor, Resolvable } from '../contracts/Container.ts'
import { ContainerResolutionError } from '../errors/ContainerResolutionError.ts'
import { ContextualBindingBuilder } from './ContextualBindingBuilder.ts'

type Binding<T> = {
  concrete: Resolvable<T>
  singleton: boolean
}

export class ContainerImpl implements Container {
  private bindings = new Map<Bindable<any>, Binding<any>>()
  private instances = new Map<Bindable<any>, any>()
  private aliases = new Map<string | symbol, Bindable<any>>()
  /** contextual[concrete][abstract] = resolvable */
  private contextual = new Map<Constructor<any>, Map<Bindable<any>, Resolvable<any>>>()
  /** Track resolution stack for circular dependency detection */
  private resolving = new Set<Bindable<any>>()

  // ── Registration ──────────────────────────────────────────────────────────

  bind<T>(abstract: Bindable<T>, concrete: Resolvable<T>): void {
    this.bindings.set(abstract, { concrete, singleton: false })
    // Clear any cached singleton instance if re-binding
    this.instances.delete(abstract)
  }

  singleton<T>(abstract: Bindable<T>, concrete: Resolvable<T>): void {
    this.bindings.set(abstract, { concrete, singleton: true })
    this.instances.delete(abstract)
  }

  instance<T>(abstract: Bindable<T>, instance: T): void {
    this.instances.set(abstract, instance)
  }

  // ── Resolution ────────────────────────────────────────────────────────────

  make<T>(abstract: Bindable<T>): T {
    // Resolve aliases
    const resolved = this.resolveAlias(abstract)

    // Return cached singleton instance
    if (this.instances.has(resolved)) {
      return this.instances.get(resolved) as T
    }

    // Detect circular dependencies
    if (this.resolving.has(resolved)) {
      throw new ContainerResolutionError(
        resolved,
        'circular_dependency',
        `Circular dependency detected while resolving ${String(resolved)}`,
      )
    }

    this.resolving.add(resolved)

    try {
      const binding = this.bindings.get(resolved)

      let instance: T

      if (binding) {
        instance = this.build<T>(binding.concrete)

        if (binding.singleton) {
          this.instances.set(resolved, instance)
        }
      } else if (typeof resolved === 'function') {
        // Auto-resolution: try to instantiate the class directly
        instance = this.autoResolve<T>(resolved as Constructor<T>)
      } else {
        throw new ContainerResolutionError(
          resolved,
          'not_bound',
          `No binding found for '${String(resolved)}'`,
        )
      }

      return instance
    } finally {
      this.resolving.delete(resolved)
    }
  }

  makeOrDefault<T>(abstract: Bindable<T>, defaultValue: T): T {
    try {
      return this.make(abstract)
    } catch {
      return defaultValue
    }
  }

  has(abstract: Bindable<any>): boolean {
    const resolved = this.resolveAlias(abstract)
    return this.bindings.has(resolved) || this.instances.has(resolved)
  }

  // ── Contextual Binding ────────────────────────────────────────────────────

  when(concrete: Constructor<any>): ContextualBindingBuilder {
    return new ContextualBindingBuilder(concrete, (abstract, resolvable) => {
      if (!this.contextual.has(concrete)) {
        this.contextual.set(concrete, new Map())
      }
      this.contextual.get(concrete)!.set(abstract, resolvable)
    })
  }

  // ── Aliases ───────────────────────────────────────────────────────────────

  alias(abstract: Bindable<any>, alias: string | symbol): void {
    this.aliases.set(alias, abstract)
  }

  // ── Flush ─────────────────────────────────────────────────────────────────

  flush(): void {
    this.bindings.clear()
    this.instances.clear()
    this.aliases.clear()
    this.contextual.clear()
    this.resolving.clear()
  }

  // ── Method injection ──────────────────────────────────────────────────────

  call<T>(target: object, method: string, extraParams?: Record<string, any>): T {
    const fn = (target as any)[method]
    if (typeof fn !== 'function') {
      throw new ContainerResolutionError(
        method,
        'not_bound',
        `Method '${method}' does not exist on target`,
      )
    }
    // @internal: Basic call without deep reflection; packages can override if needed
    const params = extraParams ? Object.values(extraParams) : []
    return fn.apply(target, params) as T
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private resolveAlias(abstract: Bindable<any>): Bindable<any> {
    if (typeof abstract === 'string' || typeof abstract === 'symbol') {
      return this.aliases.get(abstract as string | symbol) ?? abstract
    }
    return abstract
  }

  private build<T>(concrete: Resolvable<T>): T {
    if (typeof concrete === 'function' && concrete.prototype === undefined) {
      // Arrow function / factory
      return (concrete as (c: Container) => T)(this)
    }

    if (typeof concrete === 'function') {
      const ctor = concrete as Constructor<T>
      // Check if it looks like a factory (no prototype.constructor === Function means arrow)
      try {
        return this.autoResolve(ctor)
      } catch {
        // If autoResolve fails, try calling as factory
        return (concrete as (c: Container) => T)(this)
      }
    }

    return (concrete as (c: Container) => T)(this)
  }

  private autoResolve<T>(ctor: Constructor<T>, parentCtor?: Constructor<any>): T {
    // Try instantiating with no args first (common case)
    try {
      // Check for contextual bindings if we have a parent
      const contextMap = parentCtor ? this.contextual.get(parentCtor) : undefined

      // Attempt construction. For classes with required deps this will fail
      // but we attempt it for zero-dep classes.
      if (ctor.length === 0) {
        return new ctor()
      }

      // If we can't auto-resolve (no metadata), throw clearly
      throw new ContainerResolutionError(
        ctor,
        'unresolvable_parameter',
        `'${ctor.name}' has ${ctor.length} constructor parameter(s) that cannot be auto-resolved. Register an explicit binding.`,
      )
    } catch (err) {
      if (err instanceof ContainerResolutionError) throw err
      throw new ContainerResolutionError(
        ctor,
        'unresolvable_parameter',
        String(err),
      )
    }
  }
}
