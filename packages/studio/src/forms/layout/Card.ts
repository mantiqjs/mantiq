import type { Serializable } from '../../contracts/Serializable.ts'
import type { FormComponent } from '../contracts/FormComponent.ts'

export class Card implements Serializable {
  protected _heading: string | undefined = undefined
  protected _description: string | undefined = undefined
  protected _schema: FormComponent[] = []

  protected constructor() {}

  static make(): Card {
    return new Card()
  }

  heading(heading: string): this {
    this._heading = heading
    return this
  }

  description(description: string): this {
    this._description = description
    return this
  }

  schema(components: FormComponent[]): this {
    this._schema = components
    return this
  }

  toSchema(): Record<string, unknown> {
    return {
      type: 'card',
      heading: this._heading,
      description: this._description,
      schema: this._schema.map((c) => c.toSchema()),
    }
  }
}
