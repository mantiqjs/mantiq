import { Column } from '../contracts/Column.ts'

export class ColorColumn extends Column {
  protected _copyable: boolean = false

  static make(name: string): ColorColumn {
    return new ColorColumn(name)
  }

  override type(): string {
    return 'color'
  }

  copyable(copyable: boolean = true): this {
    this._copyable = copyable
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      copyable: this._copyable,
    }
  }
}
