/**
 * Macroable — allows dynamically adding methods to classes at runtime.
 *
 * Laravel equivalent: `Illuminate\Support\Traits\Macroable`
 *
 * Two usage patterns:
 *
 * 1. **Mixin function** — wrap a class to get full Proxy-based macro support:
 *    ```ts
 *    const MyClass = Macroable(BaseClass)
 *    MyClass.macro('custom', function() { return this.value })
 *    new MyClass().custom() // works transparently
 *    ```
 *
 * 2. **Apply to existing class** — add macro support without changing class identity:
 *    ```ts
 *    applyMacros(QueryBuilder)
 *    QueryBuilder.macro('toCsv', function() { ... })
 *    // Call via __macro() or extend the prototype
 *    ```
 *
 * For TypeScript type safety, users can augment the interface:
 *   declare module '@mantiq/database' {
 *     interface QueryBuilder { toCsv(): Promise<string> }
 *   }
 */

type Constructor<T = object> = new (...args: any[]) => T

export interface MacroableStatic {
  macro(name: string, fn: Function): void
  mixin(mixins: Record<string, Function>, replace?: boolean): void
  hasMacro(name: string): boolean
  flushMacros(): void
}

export interface MacroableInstance {
  __macro(name: string, ...args: any[]): any
}

/**
 * Mixin function that adds macro support to a class.
 *
 * Returns a Proxy-wrapped class where:
 * - Static macro/mixin/hasMacro/flushMacros methods are available
 * - Instance method calls fall through to registered macros
 * - Each subclass inherits parent macros but gets its own macro registry
 */
export function Macroable<T extends Constructor>(Base: T): T & MacroableStatic {
  class MacroableClass extends (Base as Constructor) {
    static _macros = new Map<string, Function>()

    static macro(name: string, fn: Function): void {
      this._ensureOwnMacros()
      this._macros.set(name, fn)
    }

    static mixin(mixins: Record<string, Function>, replace = true): void {
      for (const [name, fn] of Object.entries(mixins)) {
        if (replace || !this.hasMacro(name)) {
          this.macro(name, fn)
        }
      }
    }

    static hasMacro(name: string): boolean {
      return this._macros.has(name)
    }

    static flushMacros(): void {
      this._ensureOwnMacros()
      this._macros.clear()
    }

    __macro(name: string, ...args: any[]): any {
      const fn = (this.constructor as typeof MacroableClass)._macros?.get(name)
      if (!fn) {
        throw new Error(
          `Method ${name} does not exist on ${this.constructor.name}. Did you forget to register it with ${this.constructor.name}.macro()?`,
        )
      }
      return fn.apply(this, args)
    }

    private static _ensureOwnMacros(): void {
      if (!Object.prototype.hasOwnProperty.call(this, '_macros')) {
        this._macros = new Map(this._macros)
      }
    }
  }

  // Proxy for transparent macro calls on instances
  return new Proxy(MacroableClass, {
    construct(target, args, newTarget) {
      const instance = Reflect.construct(target, args, newTarget)
      return new Proxy(instance, {
        get(obj, prop, receiver) {
          const value = Reflect.get(obj, prop, receiver)
          if (value !== undefined) return value

          if (typeof prop === 'string') {
            const macroFn = (obj.constructor as typeof MacroableClass)._macros?.get(prop)
            if (macroFn) {
              return (...callArgs: any[]) => macroFn.apply(obj, callArgs)
            }
          }

          return value
        },
      })
    },
  }) as unknown as T & MacroableStatic
}

/**
 * Apply macro support to an existing class without wrapping it in a Proxy.
 *
 * This is the non-destructive approach — it doesn't change the class identity,
 * preserving `instanceof` checks and existing imports. Macros are called via
 * `instance.__macro('name', ...args)`.
 *
 * Use this for framework classes (QueryBuilder, Collection, etc.) that are
 * already widely exported.
 */
export function applyMacros<T extends Constructor>(Target: T): void {
  const macros = new Map<string, Function>()

  Object.defineProperties(Target, {
    _macros: { value: macros, writable: true, configurable: true },

    macro: {
      value(name: string, fn: Function): void {
        macros.set(name, fn)
      },
      configurable: true,
    },

    mixin: {
      value(mixins: Record<string, Function>, replace = true): void {
        for (const [name, fn] of Object.entries(mixins)) {
          if (replace || !macros.has(name)) {
            macros.set(name, fn)
          }
        }
      },
      configurable: true,
    },

    hasMacro: {
      value(name: string): boolean {
        return macros.has(name)
      },
      configurable: true,
    },

    flushMacros: {
      value(): void {
        macros.clear()
      },
      configurable: true,
    },
  })

  // Add __macro to prototype
  Target.prototype.__macro = function (name: string, ...args: any[]): any {
    const fn = macros.get(name)
    if (!fn) {
      throw new Error(
        `Method ${name} does not exist on ${Target.name}. Did you forget to register it with ${Target.name}.macro()?`,
      )
    }
    return fn.apply(this, args)
  }
}
