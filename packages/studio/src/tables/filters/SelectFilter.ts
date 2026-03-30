import { Filter } from '../contracts/Filter.ts'

export class SelectFilter extends Filter {
  protected _options: Record<string, string> = {}
  protected _multiple: boolean = false
  protected _searchable: boolean = false

  static make(name: string): SelectFilter {
    return new SelectFilter(name)
  }

  override type(): string {
    return 'select'
  }

  options(options: Record<string, string>): this {
    this._options = options
    return this
  }

  multiple(multiple: boolean = true): this {
    this._multiple = multiple
    return this
  }

  searchable(searchable: boolean = true): this {
    this._searchable = searchable
    return this
  }

  override apply(query: Record<string, unknown>, value: unknown): Record<string, unknown> {
    return { ...query, [this._name]: value }
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      options: this._options,
      multiple: this._multiple,
      searchable: this._searchable,
    }
  }
}
