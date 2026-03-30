import { FormComponent } from '../contracts/FormComponent.ts'

export class TagsInput extends FormComponent {
  protected _suggestions: string[] = []
  protected _separator: string | undefined = undefined

  static make(name: string): TagsInput {
    return new TagsInput(name)
  }

  override type(): string {
    return 'tags-input'
  }

  suggestions(suggestions: string[]): this {
    this._suggestions = suggestions
    return this
  }

  separator(separator: string): this {
    this._separator = separator
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      suggestions: this._suggestions,
      separator: this._separator,
    }
  }
}
