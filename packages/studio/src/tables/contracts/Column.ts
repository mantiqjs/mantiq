import type { Serializable } from '../../contracts/Serializable.ts'

export type ColumnAlignment = 'start' | 'center' | 'end'

export abstract class Column implements Serializable {
  protected _name: string
  protected _label: string | undefined = undefined
  protected _sortable: boolean = false
  protected _searchable: boolean = false
  protected _toggleable: boolean = false
  protected _hidden: boolean = false
  protected _alignment: ColumnAlignment = 'start'
  protected _width: string | undefined = undefined
  protected _wrap: boolean = false

  protected constructor(name: string) {
    this._name = name
  }

  abstract type(): string

  label(label: string): this {
    this._label = label
    return this
  }

  sortable(sortable: boolean = true): this {
    this._sortable = sortable
    return this
  }

  searchable(searchable: boolean = true): this {
    this._searchable = searchable
    return this
  }

  toggleable(toggleable: boolean = true): this {
    this._toggleable = toggleable
    return this
  }

  hidden(hidden: boolean = true): this {
    this._hidden = hidden
    return this
  }

  alignment(alignment: ColumnAlignment): this {
    this._alignment = alignment
    return this
  }

  width(width: string): this {
    this._width = width
    return this
  }

  wrap(wrap: boolean = true): this {
    this._wrap = wrap
    return this
  }

  protected extraSchema(): Record<string, unknown> {
    return {}
  }

  toSchema(): Record<string, unknown> {
    return {
      type: this.type(),
      name: this._name,
      label: this._label,
      sortable: this._sortable,
      searchable: this._searchable,
      toggleable: this._toggleable,
      hidden: this._hidden,
      alignment: this._alignment,
      width: this._width,
      wrap: this._wrap,
      ...this.extraSchema(),
    }
  }
}
