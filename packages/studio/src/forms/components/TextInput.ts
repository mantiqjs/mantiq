import { FormComponent } from '../contracts/FormComponent.ts'

export type TextInputType = 'text' | 'email' | 'password' | 'tel' | 'url' | 'number'

export class TextInput extends FormComponent {
  protected _inputType: TextInputType = 'text'
  protected _maxLength: number | undefined = undefined
  protected _minLength: number | undefined = undefined
  protected _prefix: string | undefined = undefined
  protected _suffix: string | undefined = undefined
  protected _mask: string | undefined = undefined

  static make(name: string): TextInput {
    return new TextInput(name)
  }

  override type(): string {
    return 'text-input'
  }

  email(): this {
    this._inputType = 'email'
    return this
  }

  password(): this {
    this._inputType = 'password'
    return this
  }

  tel(): this {
    this._inputType = 'tel'
    return this
  }

  url(): this {
    this._inputType = 'url'
    return this
  }

  numeric(): this {
    this._inputType = 'number'
    return this
  }

  maxLength(length: number): this {
    this._maxLength = length
    return this
  }

  minLength(length: number): this {
    this._minLength = length
    return this
  }

  prefix(prefix: string): this {
    this._prefix = prefix
    return this
  }

  suffix(suffix: string): this {
    this._suffix = suffix
    return this
  }

  mask(mask: string): this {
    this._mask = mask
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      inputType: this._inputType,
      maxLength: this._maxLength,
      minLength: this._minLength,
      prefix: this._prefix,
      suffix: this._suffix,
      mask: this._mask,
    }
  }
}
