import { FormComponent } from '../contracts/FormComponent.ts'

export class KeyValue extends FormComponent {
  protected _keyLabel: string = 'Key'
  protected _valueLabel: string = 'Value'
  protected _addActionLabel: string = 'Add row'
  protected _reorderable: boolean = false

  static make(name: string): KeyValue {
    return new KeyValue(name)
  }

  override type(): string {
    return 'key-value'
  }

  keyLabel(label: string): this {
    this._keyLabel = label
    return this
  }

  valueLabel(label: string): this {
    this._valueLabel = label
    return this
  }

  addActionLabel(label: string): this {
    this._addActionLabel = label
    return this
  }

  reorderable(reorderable: boolean = true): this {
    this._reorderable = reorderable
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      keyLabel: this._keyLabel,
      valueLabel: this._valueLabel,
      addActionLabel: this._addActionLabel,
      reorderable: this._reorderable,
    }
  }
}
