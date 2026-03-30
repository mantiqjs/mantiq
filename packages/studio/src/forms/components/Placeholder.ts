import { FormComponent } from '../contracts/FormComponent.ts'

export class Placeholder extends FormComponent {
  protected _content: string | undefined = undefined

  static make(name: string): Placeholder {
    return new Placeholder(name)
  }

  override type(): string {
    return 'placeholder'
  }

  content(content: string): this {
    this._content = content
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      content: this._content,
    }
  }
}
