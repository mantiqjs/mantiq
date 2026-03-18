import type { Bindable, Resolvable } from '../contracts/Container.ts'

type GiveFn = (abstract: Bindable<any>, concrete: Resolvable<any>) => void

export class ContextualBindingBuilder {
  private needsAbstract!: Bindable<any>

  constructor(
    private readonly concrete: new (...args: any[]) => any,
    private readonly giveFn: GiveFn,
  ) {}

  needs<T>(abstract: Bindable<T>): { give<U extends T>(concrete: Resolvable<U>): void } {
    this.needsAbstract = abstract
    return {
      give: <U>(concrete: Resolvable<U>) => {
        this.giveFn(this.needsAbstract, concrete as Resolvable<any>)
      },
    }
  }
}
