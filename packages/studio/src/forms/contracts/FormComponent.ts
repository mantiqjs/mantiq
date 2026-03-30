import type { Serializable } from '../../contracts/Serializable.ts'

export abstract class FormComponent implements Serializable {
  protected _name: string
  protected _label: string | undefined = undefined
  protected _placeholder: string | undefined = undefined
  protected _helperText: string | undefined = undefined
  protected _hint: string | undefined = undefined
  protected _default: unknown = undefined
  protected _required: boolean = false
  protected _disabled: boolean = false
  protected _hidden: boolean = false
  protected _rules: string[] = []
  protected _columnSpan: number | undefined = undefined
  protected _reactive: boolean = false
  protected _dependsOn: string[] = []

  protected constructor(name: string) {
    this._name = name
  }

  abstract type(): string

  label(label: string): this {
    this._label = label
    return this
  }

  placeholder(placeholder: string): this {
    this._placeholder = placeholder
    return this
  }

  helperText(text: string): this {
    this._helperText = text
    return this
  }

  hint(hint: string): this {
    this._hint = hint
    return this
  }

  default(value: unknown): this {
    this._default = value
    return this
  }

  required(required: boolean = true): this {
    this._required = required
    return this
  }

  disabled(disabled: boolean = true): this {
    this._disabled = disabled
    return this
  }

  hidden(hidden: boolean = true): this {
    this._hidden = hidden
    return this
  }

  rules(rules: string[]): this {
    this._rules = rules
    return this
  }

  columnSpan(span: number): this {
    this._columnSpan = span
    return this
  }

  reactive(reactive: boolean = true): this {
    this._reactive = reactive
    return this
  }

  dependsOn(fields: string[]): this {
    this._dependsOn = fields
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
      placeholder: this._placeholder,
      helperText: this._helperText,
      hint: this._hint,
      default: this._default,
      required: this._required,
      disabled: this._disabled,
      hidden: this._hidden,
      rules: this._rules,
      columnSpan: this._columnSpan,
      reactive: this._reactive,
      dependsOn: this._dependsOn,
      ...this.extraSchema(),
    }
  }
}
