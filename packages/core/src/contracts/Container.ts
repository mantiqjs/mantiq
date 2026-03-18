export type Constructor<T = any> = new (...args: any[]) => T
export type Bindable<T = any> = Constructor<T> | symbol | string
export type Resolvable<T = any> = Constructor<T> | ((container: Container) => T)

export interface ContextualBindingBuilder {
  needs<T>(abstract: Bindable<T>): { give<U extends T>(concrete: Resolvable<U>): void }
}

export interface Container {
  /**
   * Register a transient binding. A new instance is created on each resolve.
   * @param abstract - The interface/class/symbol to bind
   * @param concrete - The implementation class or factory function
   */
  bind<T>(abstract: Bindable<T>, concrete: Resolvable<T>): void

  /**
   * Register a singleton binding. Created once, cached forever.
   * @param abstract - The interface/class/symbol to bind
   * @param concrete - The implementation class or factory function
   */
  singleton<T>(abstract: Bindable<T>, concrete: Resolvable<T>): void

  /**
   * Register an existing instance as a singleton.
   * @param abstract - The interface/class/symbol to bind
   * @param instance - The pre-created instance
   */
  instance<T>(abstract: Bindable<T>, instance: T): void

  /**
   * Resolve a binding from the container.
   * @param abstract - The interface/class/symbol to resolve
   * @throws ContainerResolutionError if the binding can't be resolved
   */
  make<T>(abstract: Bindable<T>): T

  /**
   * Resolve a binding, or return the default if not bound.
   */
  makeOrDefault<T>(abstract: Bindable<T>, defaultValue: T): T

  /**
   * Check if a binding exists.
   */
  has(abstract: Bindable<any>): boolean

  /**
   * Start building a contextual binding.
   * @example container.when(UserController).needs(Logger).give(UserLogger)
   */
  when(concrete: Constructor<any>): ContextualBindingBuilder

  /**
   * Register an alias for an abstract.
   */
  alias(abstract: Bindable<any>, alias: string | symbol): void

  /**
   * Remove all bindings and cached instances.
   */
  flush(): void

  /**
   * Call a method on an object, injecting its dependencies.
   */
  call<T>(target: object, method: string, extraParams?: Record<string, any>): T
}
