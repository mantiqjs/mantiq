import { Column } from '../contracts/Column.ts'

export class ImageColumn extends Column {
  protected _circular: boolean = false
  protected _square: boolean = false
  protected _size: number | undefined = undefined
  protected _defaultUrl: string | undefined = undefined

  static make(name: string): ImageColumn {
    return new ImageColumn(name)
  }

  override type(): string {
    return 'image'
  }

  circular(circular: boolean = true): this {
    this._circular = circular
    return this
  }

  square(square: boolean = true): this {
    this._square = square
    return this
  }

  size(size: number): this {
    this._size = size
    return this
  }

  defaultUrl(url: string): this {
    this._defaultUrl = url
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      circular: this._circular,
      square: this._square,
      size: this._size,
      defaultUrl: this._defaultUrl,
    }
  }
}
