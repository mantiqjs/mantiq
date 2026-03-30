import { Column } from '../contracts/Column.ts'

export class BooleanColumn extends Column {
  protected _trueIcon: string | undefined = undefined
  protected _falseIcon: string | undefined = undefined
  protected _trueColor: string | undefined = undefined
  protected _falseColor: string | undefined = undefined

  static make(name: string): BooleanColumn {
    return new BooleanColumn(name)
  }

  override type(): string {
    return 'boolean'
  }

  trueIcon(icon: string): this {
    this._trueIcon = icon
    return this
  }

  falseIcon(icon: string): this {
    this._falseIcon = icon
    return this
  }

  trueColor(color: string): this {
    this._trueColor = color
    return this
  }

  falseColor(color: string): this {
    this._falseColor = color
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      trueIcon: this._trueIcon,
      falseIcon: this._falseIcon,
      trueColor: this._trueColor,
      falseColor: this._falseColor,
    }
  }
}
