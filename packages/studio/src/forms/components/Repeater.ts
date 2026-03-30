import { FormComponent } from '../contracts/FormComponent.ts'

export class Repeater extends FormComponent {
  protected _schema: FormComponent[] = []
  protected _minItems: number | undefined = undefined
  protected _maxItems: number | undefined = undefined
  protected _collapsible: boolean = false
  protected _reorderable: boolean = true
  protected _addActionLabel: string = 'Add item'

  static make(name: string): Repeater {
    return new Repeater(name)
  }

  override type(): string {
    return 'repeater'
  }

  schema(components: FormComponent[]): this {
    this._schema = components
    return this
  }

  minItems(min: number): this {
    this._minItems = min
    return this
  }

  maxItems(max: number): this {
    this._maxItems = max
    return this
  }

  collapsible(collapsible: boolean = true): this {
    this._collapsible = collapsible
    return this
  }

  reorderable(reorderable: boolean = true): this {
    this._reorderable = reorderable
    return this
  }

  addActionLabel(label: string): this {
    this._addActionLabel = label
    return this
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      schema: this._schema.map((c) => c.toSchema()),
      minItems: this._minItems,
      maxItems: this._maxItems,
      collapsible: this._collapsible,
      reorderable: this._reorderable,
      addActionLabel: this._addActionLabel,
    }
  }
}
