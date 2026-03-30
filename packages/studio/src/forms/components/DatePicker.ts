import { FormComponent } from '../contracts/FormComponent.ts'

export class DatePicker extends FormComponent {
  protected _format: string | undefined = undefined
  protected _minDate: string | undefined = undefined
  protected _maxDate: string | undefined = undefined
  protected _withTime: boolean = false

  static make(name: string): DatePicker {
    return new DatePicker(name)
  }

  override type(): string {
    return 'date-picker'
  }

  format(format: string): this {
    this._format = format
    return this
  }

  minDate(date: string): this {
    this._minDate = date
    return this
  }

  maxDate(date: string): this {
    this._maxDate = date
    return this
  }

  withTime(withTime: boolean = true): this {
    this._withTime = withTime
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      format: this._format,
      minDate: this._minDate,
      maxDate: this._maxDate,
      withTime: this._withTime,
    }
  }
}
