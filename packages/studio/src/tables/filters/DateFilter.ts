import { Filter } from '../contracts/Filter.ts'

export class DateFilter extends Filter {
  static make(name: string): DateFilter {
    return new DateFilter(name)
  }

  override type(): string {
    return 'date'
  }

  override apply(query: Record<string, unknown>, value: unknown): Record<string, unknown> {
    return { ...query, [this._name]: value }
  }
}
