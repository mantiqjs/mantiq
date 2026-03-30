import { Column } from '../contracts/Column.ts'

export class TextColumn extends Column {
  protected _limit: number | undefined = undefined
  protected _prefix: string | undefined = undefined
  protected _suffix: string | undefined = undefined
  protected _dateTime: boolean = false
  protected _date: boolean = false
  protected _since: boolean = false
  protected _money: boolean = false
  protected _numeric: boolean = false
  protected _badge: boolean = false
  protected _color: string | undefined = undefined
  protected _icon: string | undefined = undefined
  protected _copyable: boolean = false

  static make(name: string): TextColumn {
    return new TextColumn(name)
  }

  override type(): string {
    return 'text'
  }

  limit(limit: number): this {
    this._limit = limit
    return this
  }

  prefix(prefix: string): this {
    this._prefix = prefix
    return this
  }

  suffix(suffix: string): this {
    this._suffix = suffix
    return this
  }

  dateTime(dateTime: boolean = true): this {
    this._dateTime = dateTime
    return this
  }

  date(date: boolean = true): this {
    this._date = date
    return this
  }

  since(since: boolean = true): this {
    this._since = since
    return this
  }

  money(money: boolean = true): this {
    this._money = money
    return this
  }

  numeric(numeric: boolean = true): this {
    this._numeric = numeric
    return this
  }

  badge(badge: boolean = true): this {
    this._badge = badge
    return this
  }

  color(color: string): this {
    this._color = color
    return this
  }

  icon(icon: string): this {
    this._icon = icon
    return this
  }

  copyable(copyable: boolean = true): this {
    this._copyable = copyable
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      limit: this._limit,
      prefix: this._prefix,
      suffix: this._suffix,
      dateTime: this._dateTime,
      date: this._date,
      since: this._since,
      money: this._money,
      numeric: this._numeric,
      badge: this._badge,
      color: this._color,
      icon: this._icon,
      copyable: this._copyable,
    }
  }
}
