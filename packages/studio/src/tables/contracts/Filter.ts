import type { Serializable } from '../../contracts/Serializable.ts'

export abstract class Filter implements Serializable {
  protected _name: string
  protected _label: string | undefined = undefined
  protected _default: unknown = undefined

  protected constructor(name: string) {
    this._name = name
  }

  abstract type(): string

  getName(): string {
    return this._name
  }

  abstract apply(query: Record<string, unknown>, value: unknown): Record<string, unknown>

  label(label: string): this {
    this._label = label
    return this
  }

  default(value: unknown): this {
    this._default = value
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
      default: this._default,
      ...this.extraSchema(),
    }
  }
}
