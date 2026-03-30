import { Column } from '../contracts/Column.ts'

export class BadgeColumn extends Column {
  protected _colors: Record<string, string> = {}
  protected _icons: Record<string, string> = {}

  static make(name: string): BadgeColumn {
    return new BadgeColumn(name)
  }

  override type(): string {
    return 'badge'
  }

  colors(colors: Record<string, string>): this {
    this._colors = colors
    return this
  }

  icons(icons: Record<string, string>): this {
    this._icons = icons
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      colors: this._colors,
      icons: this._icons,
    }
  }
}
