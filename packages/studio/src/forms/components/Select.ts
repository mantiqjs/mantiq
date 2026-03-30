import { FormComponent } from '../contracts/FormComponent.ts'

export class Select extends FormComponent {
  protected _options: Record<string, string> | null = null
  protected _relationship: string | undefined = undefined
  protected _searchable: boolean = false
  protected _multiple: boolean = false
  protected _preload: boolean = false
  protected _native: boolean = false

  static make(name: string): Select {
    return new Select(name)
  }

  override type(): string {
    return 'select'
  }

  options(options: Record<string, string>): this {
    this._options = options
    return this
  }

  relationship(relationship: string): this {
    this._relationship = relationship
    return this
  }

  searchable(searchable: boolean = true): this {
    this._searchable = searchable
    return this
  }

  multiple(multiple: boolean = true): this {
    this._multiple = multiple
    return this
  }

  preload(preload: boolean = true): this {
    this._preload = preload
    return this
  }

  native(native: boolean = true): this {
    this._native = native
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      options: this._options,
      relationship: this._relationship,
      searchable: this._searchable,
      multiple: this._multiple,
      preload: this._preload,
      native: this._native,
    }
  }
}
