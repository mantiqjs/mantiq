import { FormComponent } from '../contracts/FormComponent.ts'

export type ColorFormat = 'hex' | 'rgb' | 'hsl'

export class ColorPicker extends FormComponent {
  protected _format: ColorFormat = 'hex'

  static make(name: string): ColorPicker {
    return new ColorPicker(name)
  }

  override type(): string {
    return 'color-picker'
  }

  format(format: ColorFormat): this {
    this._format = format
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      format: this._format,
    }
  }
}
