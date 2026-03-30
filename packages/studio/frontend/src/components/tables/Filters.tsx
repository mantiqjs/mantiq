import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import type { FilterSchema } from '@/components/forms/types'

export interface FiltersProps {
  filters: FilterSchema[]
  values: Record<string, string>
  onChange: (name: string, value: string) => void
}

export function Filters({ filters, values, onChange }: FiltersProps) {
  if (filters.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => {
        switch (filter.type) {
          case 'select':
            return (
              <SelectFilter
                key={filter.name}
                filter={filter}
                value={values[filter.name] ?? ''}
                onChange={(val) => onChange(filter.name, val)}
              />
            )
          case 'ternary':
            return (
              <TernaryFilter
                key={filter.name}
                filter={filter}
                value={values[filter.name] ?? ''}
                onChange={(val) => onChange(filter.name, val)}
              />
            )
          case 'date':
            return (
              <DateFilter
                key={filter.name}
                filter={filter}
                value={values[filter.name] ?? ''}
                onChange={(val) => onChange(filter.name, val)}
              />
            )
          default:
            return null
        }
      })}

      {Object.values(values).some(Boolean) && (
        <button
          type="button"
          onClick={() => {
            for (const filter of filters) {
              onChange(filter.name, '')
            }
          }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon name="x" className="h-3.5 w-3.5" />
          Clear filters
        </button>
      )}
    </div>
  )
}

// ── Select Filter ─────────────────────────────────────────────────────────────

function SelectFilter({
  filter,
  value,
  onChange,
}: {
  filter: FilterSchema
  value: string
  onChange: (val: string) => void
}) {
  const options = (filter.options ?? {}) as Record<string, string>

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
    >
      <option value="">{filter.label ?? filter.name}</option>
      {Object.entries(options).map(([key, label]) => (
        <option key={key} value={key}>{label}</option>
      ))}
    </select>
  )
}

// ── Ternary Filter ────────────────────────────────────────────────────────────

function TernaryFilter({
  filter,
  value,
  onChange,
}: {
  filter: FilterSchema
  value: string
  onChange: (val: string) => void
}) {
  const trueLabel = (filter.trueLabel as string) ?? 'Yes'
  const falseLabel = (filter.falseLabel as string) ?? 'No'

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
    >
      <option value="">{filter.label ?? 'All'}</option>
      <option value="true">{trueLabel}</option>
      <option value="false">{falseLabel}</option>
    </select>
  )
}

// ── Date Filter ───────────────────────────────────────────────────────────────

function DateFilter({
  filter,
  value,
  onChange,
}: {
  filter: FilterSchema
  value: string
  onChange: (val: string) => void
}) {
  // We encode the range as "from,to" in a single string
  const [from, to] = value ? value.split(',') : ['', '']

  function updateRange(part: 'from' | 'to', val: string) {
    const newFrom = part === 'from' ? val : from
    const newTo = part === 'to' ? val : to
    if (!newFrom && !newTo) {
      onChange('')
    } else {
      onChange(`${newFrom ?? ''},${newTo ?? ''}`)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm text-muted-foreground">{filter.label ?? filter.name}:</span>
      <input
        type="date"
        value={from ?? ''}
        onChange={(e) => updateRange('from', e.target.value)}
        className={cn(
          'h-9 rounded-md border border-input bg-background px-2 text-sm ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        )}
      />
      <span className="text-sm text-muted-foreground">to</span>
      <input
        type="date"
        value={to ?? ''}
        onChange={(e) => updateRange('to', e.target.value)}
        className={cn(
          'h-9 rounded-md border border-input bg-background px-2 text-sm ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        )}
      />
    </div>
  )
}
