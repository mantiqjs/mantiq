import type { Serializable } from '../contracts/Serializable.ts'
import type { FormComponent } from './contracts/FormComponent.ts'

export class Form implements Serializable {
  protected _components: FormComponent[] = []
  protected _columns: number = 1

  protected constructor(components: FormComponent[]) {
    this._components = components
  }

  static make(components: FormComponent[]): Form {
    return new Form(components)
  }

  columns(count: number): this {
    this._columns = count
    return this
  }

  toSchema(): Record<string, unknown> {
    return {
      type: 'form',
      components: this._components.map((c) => c.toSchema()),
      columns: this._columns,
    }
  }
}
