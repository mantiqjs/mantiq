import { FormComponent } from '../contracts/FormComponent.ts'

export class Radio extends FormComponent {
  protected _options: Record<string, string> = {}
  protected _inline: boolean = false

  static make(name: string): Radio {
    return new Radio(name)
  }

  override type(): string {
    return 'radio'
  }

  options(options: Record<string, string>): this {
    this._options = options
    return this
  }

  inline(inline: boolean = true): this {
    this._inline = inline
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      options: this._options,
      inline: this._inline,
    }
  }
}
