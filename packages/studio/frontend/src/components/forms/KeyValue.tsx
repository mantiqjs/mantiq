import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import type { FormComponentSchema } from '@/components/forms/types'

interface KeyValuePair {
  key: string
  value: string
}

export interface KeyValueProps {
  schema: FormComponentSchema & {
    keyLabel?: string
    valueLabel?: string
    addActionLabel?: string
    reorderable?: boolean
  }
  value: KeyValuePair[] | Record<string, string>
  onChange: (value: KeyValuePair[]) => void
  error?: string[]
}

function normalizeValue(val: KeyValuePair[] | Record<string, string> | undefined | null): KeyValuePair[] {
  if (!val) return []
  if (Array.isArray(val)) return val
  return Object.entries(val).map(([key, value]) => ({ key, value }))
}

export function KeyValue({ schema, value, onChange, error }: KeyValueProps) {
  const pairs = normalizeValue(value)
  const hasError = error && error.length > 0
  const keyLabel = schema.keyLabel ?? 'Key'
  const valueLabel = schema.valueLabel ?? 'Value'
  const addLabel = schema.addActionLabel ?? 'Add row'
  const reorderable = schema.reorderable ?? false

  function addRow() {
    onChange([...pairs, { key: '', value: '' }])
  }

  function removeRow(index: number) {
    const next = [...pairs]
    next.splice(index, 1)
    onChange(next)
  }

  function updateRow(index: number, field: 'key' | 'value', val: string) {
    const next = [...pairs]
    next[index] = { ...next[index], [field]: val }
    onChange(next)
  }

  function moveRow(from: number, to: number) {
    if (to < 0 || to >= pairs.length) return
    const next = [...pairs]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {schema.label && (
        <label className="text-sm font-medium leading-none">
          {schema.label}
          {schema.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <div className={cn(
        'rounded-md border border-input',
        hasError && 'border-destructive',
      )}>
        {/* Header */}
        <div className="flex items-center border-b border-input bg-muted/50 px-3 py-2 text-sm font-medium text-muted-foreground">
          {reorderable && <span className="w-8 shrink-0" />}
          <span className="flex-1 px-1">{keyLabel}</span>
          <span className="flex-1 px-1">{valueLabel}</span>
          <span className="w-8 shrink-0" />
        </div>

        {/* Rows */}
        {pairs.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No entries yet.
          </div>
        ) : (
          pairs.map((pair, index) => (
            <div key={index} className="flex items-center border-b border-input last:border-b-0 px-3 py-2 gap-2">
              {reorderable && (
                <div className="flex flex-col w-8 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveRow(index, index - 1)}
                    disabled={index === 0 || schema.disabled}
                    className="rounded p-0.5 hover:bg-muted disabled:opacity-50"
                  >
                    <Icon name="chevron-up" className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRow(index, index + 1)}
                    disabled={index === pairs.length - 1 || schema.disabled}
                    className="rounded p-0.5 hover:bg-muted disabled:opacity-50"
                  >
                    <Icon name="chevron-down" className="h-3 w-3" />
                  </button>
                </div>
              )}

              <input
                type="text"
                value={pair.key}
                onChange={(e) => updateRow(index, 'key', e.target.value)}
                placeholder={keyLabel}
                disabled={schema.disabled}
                className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />

              <input
                type="text"
                value={pair.value}
                onChange={(e) => updateRow(index, 'value', e.target.value)}
                placeholder={valueLabel}
                disabled={schema.disabled}
                className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />

              <button
                type="button"
                onClick={() => removeRow(index)}
                disabled={schema.disabled}
                className="w-8 shrink-0 flex items-center justify-center rounded p-1 text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <Icon name="trash-2" className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={addRow}
        disabled={schema.disabled}
        className={cn(
          'flex items-center gap-2 text-sm text-muted-foreground transition-colors',
          'hover:text-foreground',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <Icon name="plus" className="h-4 w-4" />
        {addLabel}
      </button>

      {schema.helperText && !hasError && (
        <p className="text-sm text-muted-foreground">{schema.helperText}</p>
      )}

      {hasError && (
        <div className="space-y-1">
          {error.map((msg, i) => (
            <p key={i} className="text-sm text-destructive">{msg}</p>
          ))}
        </div>
      )}
    </div>
  )
}
