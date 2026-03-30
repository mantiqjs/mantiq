// @ts-nocheck
import { describe, it, expect } from 'bun:test'
import { TextColumn } from '../../../src/tables/columns/TextColumn.ts'
import { BadgeColumn } from '../../../src/tables/columns/BadgeColumn.ts'
import { BooleanColumn } from '../../../src/tables/columns/BooleanColumn.ts'
import { ImageColumn } from '../../../src/tables/columns/ImageColumn.ts'
import { IconColumn } from '../../../src/tables/columns/IconColumn.ts'
import { ColorColumn } from '../../../src/tables/columns/ColorColumn.ts'
import { SelectFilter } from '../../../src/tables/filters/SelectFilter.ts'
import { TernaryFilter } from '../../../src/tables/filters/TernaryFilter.ts'
import { DateFilter } from '../../../src/tables/filters/DateFilter.ts'
import { Table } from '../../../src/tables/Table.ts'

describe('TextColumn', () => {
  it('creates via static make', () => {
    const schema = TextColumn.make('name').toSchema()
    expect(schema.type).toBe('text')
    expect(schema.name).toBe('name')
  })

  it('enables sortable', () => {
    const schema = TextColumn.make('name').sortable().toSchema()
    expect(schema.sortable).toBe(true)
  })

  it('enables searchable', () => {
    const schema = TextColumn.make('name').searchable().toSchema()
    expect(schema.searchable).toBe(true)
  })

  it('enables dateTime formatting', () => {
    const schema = TextColumn.make('created_at').dateTime().toSchema()
    expect(schema.dateTime).toBe(true)
  })

  it('enables date formatting', () => {
    const schema = TextColumn.make('birthday').date().toSchema()
    expect(schema.date).toBe(true)
  })

  it('enables since formatting', () => {
    const schema = TextColumn.make('created_at').since().toSchema()
    expect(schema.since).toBe(true)
  })

  it('enables money formatting', () => {
    const schema = TextColumn.make('price').money().toSchema()
    expect(schema.money).toBe(true)
  })

  it('enables numeric formatting', () => {
    const schema = TextColumn.make('count').numeric().toSchema()
    expect(schema.numeric).toBe(true)
  })

  it('sets limit', () => {
    const schema = TextColumn.make('description').limit(50).toSchema()
    expect(schema.limit).toBe(50)
  })

  it('enables copyable', () => {
    const schema = TextColumn.make('email').copyable().toSchema()
    expect(schema.copyable).toBe(true)
  })

  it('enables badge display', () => {
    const schema = TextColumn.make('status').badge().toSchema()
    expect(schema.badge).toBe(true)
  })

  it('sets color', () => {
    const schema = TextColumn.make('status').color('green').toSchema()
    expect(schema.color).toBe('green')
  })

  it('sets icon', () => {
    const schema = TextColumn.make('status').icon('check').toSchema()
    expect(schema.icon).toBe('check')
  })

  it('sets prefix and suffix', () => {
    const schema = TextColumn.make('price').prefix('$').suffix(' USD').toSchema()
    expect(schema.prefix).toBe('$')
    expect(schema.suffix).toBe(' USD')
  })

  it('sets label', () => {
    const schema = TextColumn.make('user_name').label('Username').toSchema()
    expect(schema.label).toBe('Username')
  })

  it('sets alignment', () => {
    const schema = TextColumn.make('amount').alignment('end').toSchema()
    expect(schema.alignment).toBe('end')
  })

  it('sets width', () => {
    const schema = TextColumn.make('id').width('80px').toSchema()
    expect(schema.width).toBe('80px')
  })

  it('enables wrap', () => {
    const schema = TextColumn.make('desc').wrap().toSchema()
    expect(schema.wrap).toBe(true)
  })

  it('enables toggleable', () => {
    const schema = TextColumn.make('notes').toggleable().toSchema()
    expect(schema.toggleable).toBe(true)
  })

  it('enables hidden', () => {
    const schema = TextColumn.make('internal').hidden().toSchema()
    expect(schema.hidden).toBe(true)
  })

  it('chains multiple methods', () => {
    const schema = TextColumn.make('name')
      .label('Full Name')
      .sortable()
      .searchable()
      .limit(30)
      .copyable()
      .toSchema()

    expect(schema.label).toBe('Full Name')
    expect(schema.sortable).toBe(true)
    expect(schema.searchable).toBe(true)
    expect(schema.limit).toBe(30)
    expect(schema.copyable).toBe(true)
  })

  it('defaults sortable to false', () => {
    const schema = TextColumn.make('name').toSchema()
    expect(schema.sortable).toBe(false)
  })

  it('defaults searchable to false', () => {
    const schema = TextColumn.make('name').toSchema()
    expect(schema.searchable).toBe(false)
  })
})

describe('BadgeColumn', () => {
  it('creates via static make', () => {
    const schema = BadgeColumn.make('status').toSchema()
    expect(schema.type).toBe('badge')
    expect(schema.name).toBe('status')
  })

  it('sets colors mapping', () => {
    const colors = { active: 'green', inactive: 'red', pending: 'yellow' }
    const schema = BadgeColumn.make('status').colors(colors).toSchema()
    expect(schema.colors).toEqual(colors)
  })

  it('sets icons mapping', () => {
    const icons = { active: 'check', inactive: 'x' }
    const schema = BadgeColumn.make('status').icons(icons).toSchema()
    expect(schema.icons).toEqual(icons)
  })

  it('defaults to empty colors and icons', () => {
    const schema = BadgeColumn.make('status').toSchema()
    expect(schema.colors).toEqual({})
    expect(schema.icons).toEqual({})
  })

  it('chains colors and icons', () => {
    const schema = BadgeColumn.make('status')
      .colors({ active: 'green' })
      .icons({ active: 'check' })
      .sortable()
      .toSchema()

    expect(schema.colors).toEqual({ active: 'green' })
    expect(schema.icons).toEqual({ active: 'check' })
    expect(schema.sortable).toBe(true)
  })
})

describe('BooleanColumn', () => {
  it('creates via static make', () => {
    const schema = BooleanColumn.make('is_active').toSchema()
    expect(schema.type).toBe('boolean')
    expect(schema.name).toBe('is_active')
  })

  it('sets trueIcon', () => {
    const schema = BooleanColumn.make('active').trueIcon('check-circle').toSchema()
    expect(schema.trueIcon).toBe('check-circle')
  })

  it('sets falseIcon', () => {
    const schema = BooleanColumn.make('active').falseIcon('x-circle').toSchema()
    expect(schema.falseIcon).toBe('x-circle')
  })

  it('sets trueColor', () => {
    const schema = BooleanColumn.make('active').trueColor('green').toSchema()
    expect(schema.trueColor).toBe('green')
  })

  it('sets falseColor', () => {
    const schema = BooleanColumn.make('active').falseColor('red').toSchema()
    expect(schema.falseColor).toBe('red')
  })

  it('chains all icon/color methods', () => {
    const schema = BooleanColumn.make('verified')
      .trueIcon('check')
      .falseIcon('x')
      .trueColor('success')
      .falseColor('danger')
      .toSchema()

    expect(schema.trueIcon).toBe('check')
    expect(schema.falseIcon).toBe('x')
    expect(schema.trueColor).toBe('success')
    expect(schema.falseColor).toBe('danger')
  })
})

describe('ImageColumn', () => {
  it('creates via static make', () => {
    const schema = ImageColumn.make('avatar').toSchema()
    expect(schema.type).toBe('image')
    expect(schema.name).toBe('avatar')
  })

  it('enables circular', () => {
    const schema = ImageColumn.make('avatar').circular().toSchema()
    expect(schema.circular).toBe(true)
  })

  it('enables square', () => {
    const schema = ImageColumn.make('avatar').square().toSchema()
    expect(schema.square).toBe(true)
  })

  it('sets size', () => {
    const schema = ImageColumn.make('avatar').size(40).toSchema()
    expect(schema.size).toBe(40)
  })

  it('sets defaultUrl', () => {
    const schema = ImageColumn.make('avatar')
      .defaultUrl('/placeholder.png')
      .toSchema()
    expect(schema.defaultUrl).toBe('/placeholder.png')
  })

  it('defaults circular to false', () => {
    const schema = ImageColumn.make('avatar').toSchema()
    expect(schema.circular).toBe(false)
  })
})

describe('IconColumn', () => {
  it('creates via static make', () => {
    const schema = IconColumn.make('icon').toSchema()
    expect(schema.type).toBe('icon')
    expect(schema.name).toBe('icon')
  })

  it('enables boolean mode', () => {
    const schema = IconColumn.make('status').boolean().toSchema()
    expect(schema.boolean).toBe(true)
  })

  it('sets color', () => {
    const schema = IconColumn.make('type').color('blue').toSchema()
    expect(schema.color).toBe('blue')
  })

  it('sets size', () => {
    const schema = IconColumn.make('type').size('lg').toSchema()
    expect(schema.size).toBe('lg')
  })
})

describe('ColorColumn', () => {
  it('creates via static make', () => {
    const schema = ColorColumn.make('theme_color').toSchema()
    expect(schema.type).toBe('color')
    expect(schema.name).toBe('theme_color')
  })

  it('enables copyable', () => {
    const schema = ColorColumn.make('color').copyable().toSchema()
    expect(schema.copyable).toBe(true)
  })

  it('defaults copyable to false', () => {
    const schema = ColorColumn.make('color').toSchema()
    expect(schema.copyable).toBe(false)
  })
})

describe('SelectFilter', () => {
  it('creates via static make', () => {
    const schema = SelectFilter.make('status').toSchema()
    expect(schema.type).toBe('select')
    expect(schema.name).toBe('status')
  })

  it('sets options', () => {
    const opts = { active: 'Active', inactive: 'Inactive' }
    const schema = SelectFilter.make('status').options(opts).toSchema()
    expect(schema.options).toEqual(opts)
  })

  it('enables multiple', () => {
    const schema = SelectFilter.make('status').multiple().toSchema()
    expect(schema.multiple).toBe(true)
  })

  it('enables searchable', () => {
    const schema = SelectFilter.make('category').searchable().toSchema()
    expect(schema.searchable).toBe(true)
  })

  it('applies filter to query', () => {
    const filter = SelectFilter.make('status')
    const result = filter.apply({ other: 'val' }, 'active')
    expect(result).toEqual({ other: 'val', status: 'active' })
  })

  it('sets label', () => {
    const schema = SelectFilter.make('status').label('Status').toSchema()
    expect(schema.label).toBe('Status')
  })

  it('sets default value', () => {
    const schema = SelectFilter.make('status').default('active').toSchema()
    expect(schema.default).toBe('active')
  })
})

describe('TernaryFilter', () => {
  it('creates via static make', () => {
    const schema = TernaryFilter.make('is_active').toSchema()
    expect(schema.type).toBe('ternary')
    expect(schema.name).toBe('is_active')
  })

  it('sets custom labels', () => {
    const schema = TernaryFilter.make('verified')
      .trueLabel('Verified')
      .falseLabel('Unverified')
      .toSchema()
    expect(schema.trueLabel).toBe('Verified')
    expect(schema.falseLabel).toBe('Unverified')
  })

  it('has default labels', () => {
    const schema = TernaryFilter.make('active').toSchema()
    expect(schema.trueLabel).toBe('Yes')
    expect(schema.falseLabel).toBe('No')
  })

  it('applies filter to query', () => {
    const filter = TernaryFilter.make('active')
    const result = filter.apply({}, true)
    expect(result).toEqual({ active: true })
  })
})

describe('DateFilter', () => {
  it('creates via static make', () => {
    const schema = DateFilter.make('created_at').toSchema()
    expect(schema.type).toBe('date')
    expect(schema.name).toBe('created_at')
  })

  it('applies filter to query', () => {
    const filter = DateFilter.make('created_at')
    const result = filter.apply({}, '2024-01-01')
    expect(result).toEqual({ created_at: '2024-01-01' })
  })

  it('sets label', () => {
    const schema = DateFilter.make('created_at').label('Created Date').toSchema()
    expect(schema.label).toBe('Created Date')
  })
})

describe('Table', () => {
  it('creates via static make with columns', () => {
    const table = Table.make([TextColumn.make('name')])
    const schema = table.toSchema()
    expect(schema.type).toBe('table')
    const columns = schema.columns as Record<string, unknown>[]
    expect(columns).toHaveLength(1)
    expect(columns[0].name).toBe('name')
  })

  it('sets filters', () => {
    const table = Table.make([TextColumn.make('name')])
      .filters([SelectFilter.make('status')])

    const schema = table.toSchema()
    const filters = schema.filters as Record<string, unknown>[]
    expect(filters).toHaveLength(1)
    expect(filters[0].name).toBe('status')
  })

  it('enables searchable', () => {
    const schema = Table.make([]).searchable().toSchema()
    expect(schema.searchable).toBe(true)
  })

  it('disables searchable', () => {
    const schema = Table.make([]).searchable(false).toSchema()
    expect(schema.searchable).toBe(false)
  })

  it('defaults searchable to true', () => {
    const schema = Table.make([]).toSchema()
    expect(schema.searchable).toBe(true)
  })

  it('enables paginated', () => {
    const schema = Table.make([]).paginated().toSchema()
    expect(schema.paginated).toBe(true)
  })

  it('defaults paginated to true', () => {
    const schema = Table.make([]).toSchema()
    expect(schema.paginated).toBe(true)
  })

  it('sets pagination page options', () => {
    const schema = Table.make([]).paginationPageOptions([5, 10, 20]).toSchema()
    expect(schema.paginationPageOptions).toEqual([5, 10, 20])
  })

  it('sets default sort', () => {
    const schema = Table.make([]).defaultSort('created_at', 'desc').toSchema()
    expect(schema.defaultSort).toBe('created_at')
    expect(schema.defaultSortDirection).toBe('desc')
  })

  it('defaults sort direction to asc', () => {
    const schema = Table.make([]).defaultSort('name').toSchema()
    expect(schema.defaultSortDirection).toBe('asc')
  })

  it('enables striped', () => {
    const schema = Table.make([]).striped().toSchema()
    expect(schema.striped).toBe(true)
  })

  it('sets poll interval', () => {
    const schema = Table.make([]).poll(30).toSchema()
    expect(schema.poll).toBe(30)
  })

  it('sets empty state heading', () => {
    const schema = Table.make([]).emptyStateHeading('Nothing here').toSchema()
    expect(schema.emptyStateHeading).toBe('Nothing here')
  })

  it('sets empty state description', () => {
    const schema = Table.make([]).emptyStateDescription('Add some records').toSchema()
    expect(schema.emptyStateDescription).toBe('Add some records')
  })

  it('sets empty state icon', () => {
    const schema = Table.make([]).emptyStateIcon('folder-open').toSchema()
    expect(schema.emptyStateIcon).toBe('folder-open')
  })

  it('has default empty state heading', () => {
    const schema = Table.make([]).toSchema()
    expect(schema.emptyStateHeading).toBe('No records found')
  })

  it('has default empty state icon', () => {
    const schema = Table.make([]).toSchema()
    expect(schema.emptyStateIcon).toBe('inbox')
  })

  it('serializes all parts together', () => {
    const schema = Table.make([
      TextColumn.make('id').sortable(),
      TextColumn.make('name').searchable(),
    ])
      .filters([
        SelectFilter.make('status').options({ active: 'Active' }),
      ])
      .defaultSort('id', 'desc')
      .striped()
      .paginated()
      .paginationPageOptions([25, 50])
      .toSchema()

    const columns = schema.columns as Record<string, unknown>[]
    expect(columns).toHaveLength(2)
    const filters = schema.filters as Record<string, unknown>[]
    expect(filters).toHaveLength(1)
    expect(schema.defaultSort).toBe('id')
    expect(schema.defaultSortDirection).toBe('desc')
    expect(schema.striped).toBe(true)
    expect(schema.paginationPageOptions).toEqual([25, 50])
  })
})
