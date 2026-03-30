import { FormComponent } from '../contracts/FormComponent.ts'

export class Checkbox extends FormComponent {
  protected _inline: boolean = false

  static make(name: string): Checkbox {
    return new Checkbox(name)
  }

  override type(): string {
    return 'checkbox'
  }

  inline(inline: boolean = true): this {
    this._inline = inline
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      inline: this._inline,
    }
  }
}
