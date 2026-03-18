export class ColumnDefinition {
  private _nullable = false
  private _default: any = undefined
  private _hasDefault = false
  private _unique = false
  private _index = false
  private _unsigned = false
  private _primary = false
  private _references: { table: string; column: string; onDelete?: string; onUpdate?: string } | null = null
  private _comment: string | null = null
  private _after: string | null = null

  constructor(
    public readonly name: string,
    public readonly type: string,
    public readonly length?: number,
    public readonly precision?: number,
    public readonly scale?: number,
  ) {}

  nullable(): this {
    this._nullable = true
    return this
  }

  default(value: any): this {
    this._default = value
    this._hasDefault = true
    return this
  }

  unique(): this {
    this._unique = true
    return this
  }

  index(): this {
    this._index = true
    return this
  }

  unsigned(): this {
    this._unsigned = true
    return this
  }

  primary(): this {
    this._primary = true
    return this
  }

  references(column: string): this & { on(table: string): this } {
    this._references = { table: '', column }
    const self = this as any
    self.on = (table: string) => {
      this._references!.table = table
      return self
    }
    return self
  }

  onDelete(action: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'): this {
    if (this._references) this._references.onDelete = action
    return this
  }

  onUpdate(action: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'): this {
    if (this._references) this._references.onUpdate = action
    return this
  }

  comment(text: string): this {
    this._comment = text
    return this
  }

  after(column: string): this {
    this._after = column
    return this
  }

  // Getters for the compiler
  isNullable() { return this._nullable }
  hasDefault() { return this._hasDefault }
  getDefault() { return this._default }
  isUnique() { return this._unique }
  hasIndex() { return this._index }
  isUnsigned() { return this._unsigned }
  isPrimary() { return this._primary }
  getReferences() { return this._references }
  getComment() { return this._comment }
  getAfter() { return this._after }
}
