/**
 * Wraps a raw SQL string so the query builder won't escape/quote it.
 * @example db.raw('COUNT(*) as total')
 */
export class Expression {
  constructor(
    public readonly value: string,
    public readonly bindings: any[] = [],
  ) {}

  toString(): string {
    return this.value
  }
}

export function raw(expression: string, bindings?: any[]): Expression {
  return new Expression(expression, bindings ?? [])
}
