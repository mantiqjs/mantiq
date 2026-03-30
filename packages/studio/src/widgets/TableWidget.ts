import { Widget } from './Widget.ts'
import type { Table } from '../tables/Table.ts'

export class TableWidget extends Widget {
  protected _table: Table

  protected constructor(table: Table) {
    super()
    this._table = table
  }

  static make(table: Table): TableWidget {
    return new TableWidget(table)
  }

  override type(): string {
    return 'table'
  }

  override getData(): Record<string, unknown> {
    return this._table.toSchema()
  }

  protected override extraSchema(): Record<string, unknown> {
    return {
      table: this._table.toSchema(),
    }
  }
}
