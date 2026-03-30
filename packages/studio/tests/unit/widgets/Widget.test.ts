// @ts-nocheck
import { describe, it, expect } from 'bun:test'
import { Widget } from '../../../src/widgets/Widget.ts'
import { StatsWidget, Stat } from '../../../src/widgets/StatsWidget.ts'
import { ChartWidget } from '../../../src/widgets/ChartWidget.ts'
import type { ChartDataset } from '../../../src/widgets/ChartWidget.ts'
import { TableWidget } from '../../../src/widgets/TableWidget.ts'
import { Table } from '../../../src/tables/Table.ts'
import { TextColumn } from '../../../src/tables/columns/TextColumn.ts'

// Concrete Widget for testing abstract base
class TestWidget extends Widget {
  override type(): string {
    return 'test'
  }

  override getData(): Record<string, unknown> {
    return { test: true }
  }
}

// Concrete ChartWidget for testing abstract base
class TestChartWidget extends ChartWidget {
  override getDatasets(): ChartDataset[] {
    return [
      { label: 'Sales', data: [10, 20, 30], backgroundColor: undefined, borderColor: '#3b82f6' },
    ]
  }

  override getLabels(): string[] {
    return ['Jan', 'Feb', 'Mar']
  }
}

describe('Widget (base)', () => {
  it('sets columnSpan', () => {
    const widget = new TestWidget()
    widget.columnSpan(2)
    const schema = widget.toSchema()
    expect(schema.columnSpan).toBe(2)
  })

  it('defaults columnSpan to 1', () => {
    const widget = new TestWidget()
    const schema = widget.toSchema()
    expect(schema.columnSpan).toBe(1)
  })

  it('sets sort order', () => {
    const widget = new TestWidget()
    widget.sort(5)
    const schema = widget.toSchema()
    expect(schema.sort).toBe(5)
  })

  it('defaults sort to 0', () => {
    const widget = new TestWidget()
    expect(widget.toSchema().sort).toBe(0)
  })

  it('enables lazy loading', () => {
    const widget = new TestWidget()
    widget.lazy()
    expect(widget.toSchema().lazy).toBe(true)
  })

  it('defaults lazy to false', () => {
    const widget = new TestWidget()
    expect(widget.toSchema().lazy).toBe(false)
  })

  it('sets poll interval', () => {
    const widget = new TestWidget()
    widget.poll(30)
    expect(widget.toSchema().poll).toBe(30)
  })

  it('defaults poll to null', () => {
    const widget = new TestWidget()
    expect(widget.toSchema().poll).toBeNull()
  })

  it('includes type in schema', () => {
    const widget = new TestWidget()
    expect(widget.toSchema().type).toBe('test')
  })

  it('getData returns expected data', () => {
    const widget = new TestWidget()
    expect(widget.getData()).toEqual({ test: true })
  })
})

describe('Stat', () => {
  it('creates via static make', () => {
    const stat = Stat.make('Revenue', 1500)
    const schema = stat.toSchema()
    expect(schema.label).toBe('Revenue')
    expect(schema.value).toBe(1500)
  })

  it('accepts string value', () => {
    const schema = Stat.make('Status', 'Active').toSchema()
    expect(schema.value).toBe('Active')
  })

  it('sets description', () => {
    const schema = Stat.make('Revenue', 1500).description('Total this month').toSchema()
    expect(schema.description).toBe('Total this month')
  })

  it('sets descriptionIcon', () => {
    const schema = Stat.make('Revenue', 1500).descriptionIcon('trending-up').toSchema()
    expect(schema.descriptionIcon).toBe('trending-up')
  })

  it('sets color', () => {
    const schema = Stat.make('Revenue', 1500).color('success').toSchema()
    expect(schema.color).toBe('success')
  })

  it('sets chart data', () => {
    const data = [10, 15, 12, 18, 20]
    const schema = Stat.make('Revenue', 1500).chart(data).toSchema()
    expect(schema.chart).toEqual(data)
  })

  it('sets trend up', () => {
    const schema = Stat.make('Revenue', 1500).trend('up', '12%').toSchema()
    expect(schema.trend).toEqual({ direction: 'up', value: '12%' })
  })

  it('sets trend down', () => {
    const schema = Stat.make('Loss', 500).trend('down', '8%').toSchema()
    expect(schema.trend).toEqual({ direction: 'down', value: '8%' })
  })

  it('sets trend flat', () => {
    const schema = Stat.make('Steady', 100).trend('flat', '0%').toSchema()
    expect(schema.trend).toEqual({ direction: 'flat', value: '0%' })
  })

  it('defaults chart to empty array', () => {
    const schema = Stat.make('Test', 0).toSchema()
    expect(schema.chart).toEqual([])
  })

  it('chains all methods', () => {
    const schema = Stat.make('Users', '1,234')
      .description('Active users')
      .descriptionIcon('users')
      .color('primary')
      .chart([100, 120, 115, 130])
      .trend('up', '5%')
      .toSchema()

    expect(schema.label).toBe('Users')
    expect(schema.value).toBe('1,234')
    expect(schema.description).toBe('Active users')
    expect(schema.color).toBe('primary')
    expect(schema.chart).toEqual([100, 120, 115, 130])
  })
})

describe('StatsWidget', () => {
  it('creates via static make', () => {
    const widget = StatsWidget.make()
    expect(widget.toSchema().type).toBe('stats')
  })

  it('sets stats', () => {
    const widget = StatsWidget.make().stats([
      Stat.make('Revenue', '$10K'),
      Stat.make('Users', 500),
    ])
    const schema = widget.toSchema()
    const stats = schema.stats as Record<string, unknown>[]
    expect(stats).toHaveLength(2)
    expect(stats[0].label).toBe('Revenue')
    expect(stats[1].label).toBe('Users')
  })

  it('getData returns stats', () => {
    const widget = StatsWidget.make().stats([
      Stat.make('Test', 42),
    ])
    const data = widget.getData()
    const stats = data.stats as Record<string, unknown>[]
    expect(stats).toHaveLength(1)
    expect(stats[0].value).toBe(42)
  })

  it('supports columnSpan', () => {
    const schema = StatsWidget.make().columnSpan(3).toSchema()
    expect(schema.columnSpan).toBe(3)
  })

  it('handles empty stats', () => {
    const schema = StatsWidget.make().toSchema()
    const stats = schema.stats as unknown[]
    expect(stats).toHaveLength(0)
  })
})

describe('ChartWidget', () => {
  it('has chart type', () => {
    const widget = new TestChartWidget()
    expect(widget.toSchema().type).toBe('chart')
  })

  it('sets heading', () => {
    const widget = new TestChartWidget()
    widget.heading('Monthly Revenue')
    expect(widget.toSchema().heading).toBe('Monthly Revenue')
  })

  it('sets chartType', () => {
    const widget = new TestChartWidget()
    widget.chartType('bar')
    expect(widget.toSchema().chartType).toBe('bar')
  })

  it('defaults chartType to line', () => {
    const widget = new TestChartWidget()
    expect(widget.toSchema().chartType).toBe('line')
  })

  it('sets description', () => {
    const widget = new TestChartWidget()
    widget.description('Revenue over time')
    expect(widget.toSchema().description).toBe('Revenue over time')
  })

  it('returns datasets via getDatasets', () => {
    const widget = new TestChartWidget()
    const datasets = widget.getDatasets()
    expect(datasets).toHaveLength(1)
    expect(datasets[0].label).toBe('Sales')
    expect(datasets[0].data).toEqual([10, 20, 30])
  })

  it('returns labels via getLabels', () => {
    const widget = new TestChartWidget()
    expect(widget.getLabels()).toEqual(['Jan', 'Feb', 'Mar'])
  })

  it('getData returns datasets and labels', () => {
    const widget = new TestChartWidget()
    const data = widget.getData()
    expect(data.datasets).toBeDefined()
    expect(data.labels).toBeDefined()
  })

  it('includes datasets in schema', () => {
    const widget = new TestChartWidget()
    const schema = widget.toSchema()
    const datasets = schema.datasets as ChartDataset[]
    expect(datasets).toHaveLength(1)
    expect(schema.labels).toEqual(['Jan', 'Feb', 'Mar'])
  })

  it('supports all chart types', () => {
    for (const type of ['line', 'bar', 'pie', 'doughnut', 'area'] as const) {
      const widget = new TestChartWidget()
      widget.chartType(type)
      expect(widget.toSchema().chartType).toBe(type)
    }
  })
})

describe('TableWidget', () => {
  it('creates via static make', () => {
    const table = Table.make([TextColumn.make('name')])
    const widget = TableWidget.make(table)
    expect(widget.toSchema().type).toBe('table')
  })

  it('includes table schema in extraSchema', () => {
    const table = Table.make([
      TextColumn.make('name').sortable(),
      TextColumn.make('email'),
    ])
    const widget = TableWidget.make(table)
    const schema = widget.toSchema()
    const tableSchema = schema.table as Record<string, unknown>
    expect(tableSchema.type).toBe('table')
    const columns = tableSchema.columns as Record<string, unknown>[]
    expect(columns).toHaveLength(2)
  })

  it('getData returns table schema', () => {
    const table = Table.make([TextColumn.make('id')])
    const widget = TableWidget.make(table)
    const data = widget.getData()
    expect(data.type).toBe('table')
  })

  it('supports columnSpan', () => {
    const table = Table.make([])
    const widget = TableWidget.make(table).columnSpan(2)
    expect(widget.toSchema().columnSpan).toBe(2)
  })

  it('supports sort order', () => {
    const table = Table.make([])
    const widget = TableWidget.make(table).sort(10)
    expect(widget.toSchema().sort).toBe(10)
  })
})
