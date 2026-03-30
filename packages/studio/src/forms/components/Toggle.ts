import { FormComponent } from '../contracts/FormComponent.ts'

export class Toggle extends FormComponent {
  protected _onLabel: string | undefined = undefined
  protected _offLabel: string | undefined = undefined
  protected _onColor: string | undefined = undefined
  protected _offColor: string | undefined = undefined

  static make(name: string): Toggle {
    return new Toggle(name)
  }

  override type(): string {
    return 'toggle'
  }

  onLabel(label: string): this {
    this._onLabel = label
    return this
  }

  offLabel(label: string): this {
    this._offLabel = label
    return this
  }

  onColor(color: string): this {
    this._onColor = color
    return this
  }

  offColor(color: string): this {
    this._offColor = color
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      onLabel: this._onLabel,
      offLabel: this._offLabel,
      onColor: this._onColor,
      offColor: this._offColor,
    }
  }
}
