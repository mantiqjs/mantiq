import { Column } from '../contracts/Column.ts'

export class IconColumn extends Column {
  protected _boolean: boolean = false
  protected _color: string | undefined = undefined
  protected _size: string | undefined = undefined

  static make(name: string): IconColumn {
    return new IconColumn(name)
  }

  override type(): string {
    return 'icon'
  }

  boolean(boolean: boolean = true): this {
    this._boolean = boolean
    return this
  }

  color(color: string): this {
    this._color = color
    return this
  }

  size(size: string): this {
    this._size = size
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      boolean: this._boolean,
      color: this._color,
      size: this._size,
    }
  }
}
