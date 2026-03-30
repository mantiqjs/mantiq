import { FormComponent } from '../contracts/FormComponent.ts'

export class CheckboxList extends FormComponent {
  protected _options: Record<string, string> = {}
  protected _columns: number | undefined = undefined
  protected _searchable: boolean = false

  static make(name: string): CheckboxList {
    return new CheckboxList(name)
  }

  override type(): string {
    return 'checkbox-list'
  }

  options(options: Record<string, string>): this {
    this._options = options
    return this
  }

  columns(columns: number): this {
    this._columns = columns
    return this
  }

  searchable(searchable: boolean = true): this {
    this._searchable = searchable
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      options: this._options,
      columns: this._columns,
      searchable: this._searchable,
    }
  }
}
