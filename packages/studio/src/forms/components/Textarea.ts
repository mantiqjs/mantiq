import { FormComponent } from '../contracts/FormComponent.ts'

export class Textarea extends FormComponent {
  protected _rows: number | undefined = undefined
  protected _autosize: boolean = false

  static make(name: string): Textarea {
    return new Textarea(name)
  }

  override type(): string {
    return 'textarea'
  }

  rows(rows: number): this {
    this._rows = rows
    return this
  }

  autosize(autosize: boolean = true): this {
    this._autosize = autosize
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      rows: this._rows,
      autosize: this._autosize,
    }
  }
}
