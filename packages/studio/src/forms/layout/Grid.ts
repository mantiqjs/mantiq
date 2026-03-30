import type { Serializable } from '../../contracts/Serializable.ts'
import type { FormComponent } from '../contracts/FormComponent.ts'

export class Grid implements Serializable {
  protected _schema: FormComponent[] = []
  protected _columns: number = 2

  protected constructor() {}

  static make(): Grid {
    return new Grid()
  }

  schema(components: FormComponent[]): this {
    this._schema = components
    return this
  }

  columns(columns: number): this {
    this._columns = columns
    return this
  }

  toSchema(): Record<string, unknown> {
    return {
      type: 'grid',
      schema: this._schema.map((c) => c.toSchema()),
      columns: this._columns,
    }
  }
}
