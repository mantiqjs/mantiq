import type { Serializable } from '../../contracts/Serializable.ts'
import type { FormComponent } from '../contracts/FormComponent.ts'

export class Fieldset implements Serializable {
  protected _legend: string | undefined = undefined
  protected _schema: FormComponent[] = []

  protected constructor() {}

  static make(): Fieldset {
    return new Fieldset()
  }

  legend(legend: string): this {
    this._legend = legend
    return this
  }

  schema(components: FormComponent[]): this {
    this._schema = components
    return this
  }

  toSchema(): Record<string, unknown> {
    return {
      type: 'fieldset',
      legend: this._legend,
      schema: this._schema.map((c) => c.toSchema()),
    }
  }
}
