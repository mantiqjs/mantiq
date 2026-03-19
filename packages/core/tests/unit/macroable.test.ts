import { describe, it, expect, beforeEach } from 'bun:test'
import { Macroable, applyMacros } from '../../src/macroable/Macroable.ts'

class BaseGreeter {
  greeting: string

  constructor(greeting: string) {
    this.greeting = greeting
  }

  greet(name: string): string {
    return `${this.greeting}, ${name}!`
  }
}

const Greeter = Macroable(BaseGreeter)

class BaseCalculator {
  value: number

  constructor(value = 0) {
    this.value = value
  }

  add(n: number): this {
    this.value += n
    return this
  }
}

const Calculator = Macroable(BaseCalculator)

describe('Macroable', () => {
  beforeEach(() => {
    Greeter.flushMacros()
    Calculator.flushMacros()
  })

  // ── macro() ─────────────────────────────────────────────────────────

  it('registers and calls a macro on an instance', () => {
    Greeter.macro('shout', function (this: InstanceType<typeof Greeter>, name: string) {
      return `${this.greeting}, ${name}!!!`.toUpperCase()
    })

    const g = new Greeter('Hello')
    expect((g as any).shout('World')).toBe('HELLO, WORLD!!!')
  })

  it('macro receives correct `this` context', () => {
    Greeter.macro('getGreeting', function (this: InstanceType<typeof Greeter>) {
      return this.greeting
    })

    const a = new Greeter('Hi')
    const b = new Greeter('Hey')
    expect((a as any).getGreeting()).toBe('Hi')
    expect((b as any).getGreeting()).toBe('Hey')
  })

  it('does not shadow existing methods', () => {
    Greeter.macro('greet', function () {
      return 'MACRO'
    })

    const g = new Greeter('Hello')
    // Existing method takes precedence over macro
    expect(g.greet('World')).toBe('Hello, World!')
  })

  it('macro can return chainable this', () => {
    Calculator.macro('double', function (this: InstanceType<typeof Calculator>) {
      this.value *= 2
      return this
    })

    const c = new Calculator(5)
    ;(c as any).double()
    expect(c.value).toBe(10)
  })

  // ── hasMacro() ──────────────────────────────────────────────────────

  it('hasMacro returns true for registered macros', () => {
    Greeter.macro('custom', () => {})
    expect(Greeter.hasMacro('custom')).toBe(true)
  })

  it('hasMacro returns false for unregistered macros', () => {
    expect(Greeter.hasMacro('nope')).toBe(false)
  })

  // ── flushMacros() ───────────────────────────────────────────────────

  it('flushMacros removes all macros', () => {
    Greeter.macro('a', () => {})
    Greeter.macro('b', () => {})
    Greeter.flushMacros()
    expect(Greeter.hasMacro('a')).toBe(false)
    expect(Greeter.hasMacro('b')).toBe(false)
  })

  // ── mixin() ─────────────────────────────────────────────────────────

  it('mixin registers multiple macros at once', () => {
    Greeter.mixin({
      loud(this: InstanceType<typeof Greeter>) {
        return this.greeting.toUpperCase()
      },
      quiet(this: InstanceType<typeof Greeter>) {
        return this.greeting.toLowerCase()
      },
    })

    const g = new Greeter('Hello')
    expect((g as any).loud()).toBe('HELLO')
    expect((g as any).quiet()).toBe('hello')
  })

  it('mixin with replace=false does not overwrite existing macros', () => {
    Greeter.macro('test', () => 'original')
    Greeter.mixin({ test: () => 'replaced' }, false)

    const g = new Greeter('Hi')
    expect((g as any).test()).toBe('original')
  })

  it('mixin with replace=true overwrites existing macros', () => {
    Greeter.macro('test', () => 'original')
    Greeter.mixin({ test: () => 'replaced' }, true)

    const g = new Greeter('Hi')
    expect((g as any).test()).toBe('replaced')
  })

  // ── __macro() explicit call ─────────────────────────────────────────

  it('__macro calls a registered macro explicitly', () => {
    Greeter.macro('explicit', function (this: InstanceType<typeof Greeter>) {
      return `Explicit: ${this.greeting}`
    })

    const g = new Greeter('Hi')
    expect((g as any).__macro('explicit')).toBe('Explicit: Hi')
  })

  it('__macro throws for unregistered macro', () => {
    const g = new Greeter('Hi')
    expect(() => (g as any).__macro('nope')).toThrow('Method nope does not exist')
  })

  // ── Isolation ───────────────────────────────────────────────────────

  it('macros on one class do not leak to another', () => {
    Greeter.macro('greeterOnly', () => 'greeter')
    expect(Calculator.hasMacro('greeterOnly')).toBe(false)
  })

  it('macros work with async functions', async () => {
    Greeter.macro('asyncGreet', async function (this: InstanceType<typeof Greeter>, name: string) {
      return `${this.greeting}, ${name} (async)`
    })

    const g = new Greeter('Hello')
    const result = await (g as any).asyncGreet('World')
    expect(result).toBe('Hello, World (async)')
  })
})

// ── applyMacros (non-destructive) ────────────────────────────────────────

describe('applyMacros', () => {
  class Counter {
    value = 0
    add(n: number) { this.value += n; return this }
  }

  beforeEach(() => {
    applyMacros(Counter)
    ;(Counter as any).flushMacros()
  })

  it('adds static macro() method to class', () => {
    expect(typeof (Counter as any).macro).toBe('function')
    ;(Counter as any).macro('double', function (this: Counter) { this.value *= 2 })
    expect((Counter as any).hasMacro('double')).toBe(true)
  })

  it('adds __macro() to instances', () => {
    ;(Counter as any).macro('triple', function (this: Counter) {
      this.value *= 3
      return this.value
    })

    const c = new Counter()
    c.value = 5
    expect((c as any).__macro('triple')).toBe(15)
  })

  it('__macro throws for unregistered', () => {
    const c = new Counter()
    expect(() => (c as any).__macro('nope')).toThrow('Method nope does not exist')
  })

  it('preserves instanceof', () => {
    const c = new Counter()
    expect(c).toBeInstanceOf(Counter)
  })

  it('mixin registers multiple macros', () => {
    ;(Counter as any).mixin({
      reset(this: Counter) { this.value = 0 },
      square(this: Counter) { this.value **= 2 },
    })
    expect((Counter as any).hasMacro('reset')).toBe(true)
    expect((Counter as any).hasMacro('square')).toBe(true)
  })

  it('flushMacros clears all', () => {
    ;(Counter as any).macro('test', () => {})
    ;(Counter as any).flushMacros()
    expect((Counter as any).hasMacro('test')).toBe(false)
  })
})
