import { Filter } from '../contracts/Filter.ts'

export class TernaryFilter extends Filter {
  protected _trueLabel: string = 'Yes'
  protected _falseLabel: string = 'No'

  static make(name: string): TernaryFilter {
    return new TernaryFilter(name)
  }

  override type(): string {
    return 'ternary'
  }

  trueLabel(label: string): this {
    this._trueLabel = label
    return this
  }

  falseLabel(label: string): this {
    this._falseLabel = label
    return this
  }

  override apply(query: Record<string, unknown>, value: unknown): Record<string, unknown> {
    return { ...query, [this._name]: value }
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      trueLabel: this._trueLabel,
      falseLabel: this._falseLabel,
    }
  }
}
