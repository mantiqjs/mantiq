import type { Serializable } from '../contracts/Serializable.ts'

export abstract class Widget implements Serializable {
  protected _columnSpan: number = 1
  protected _sort: number = 0
  protected _lazy: boolean = false
  protected _poll: number | null = null

  abstract type(): string

  abstract getData(): Record<string, unknown> | Promise<Record<string, unknown>>

  columnSpan(span: number): this {
    this._columnSpan = span
    return this
  }

  sort(order: number): this {
    this._sort = order
    return this
  }

  lazy(lazy: boolean = true): this {
    this._lazy = lazy
    return this
  }

  poll(interval: number): this {
    this._poll = interval
    return this
  }

  protected extraSchema(): Record<string, unknown> {
    return {}
  }

  toSchema(): Record<string, unknown> {
    return {
      type: this.type(),
      columnSpan: this._columnSpan,
      sort: this._sort,
      lazy: this._lazy,
      poll: this._poll,
      ...this.extraSchema(),
    }
  }
}
