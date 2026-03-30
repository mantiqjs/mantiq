import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import { resolveComponent } from '@/components/registry'
import type { FormComponentSchema } from '@/components/forms/types'

export interface RepeaterProps {
  schema: FormComponentSchema & {
    schema?: FormComponentSchema[]
    minItems?: number
    maxItems?: number
    collapsible?: boolean
    reorderable?: boolean
    addActionLabel?: string
  }
  value: Record<string, unknown>[]
  onChange: (value: Record<string, unknown>[]) => void
  error?: string[]
}

export function Repeater({ schema, value, onChange, error }: RepeaterProps) {
  const items: Record<string, unknown>[] = Array.isArray(value) ? value : []
  const childSchema = schema.schema ?? []
  const hasError = error && error.length > 0
  const minItems = schema.minItems ?? 0
  const maxItems = schema.maxItems
  const reorderable = schema.reorderable ?? true
  const addLabel = schema.addActionLabel ?? 'Add item'

  function addItem() {
    if (maxItems !== undefined && items.length >= maxItems) return
    const defaults: Record<string, unknown> = {}
    for (const comp of childSchema) {
      defaults[comp.name] = comp.default ?? ''
    }
    onChange([...items, defaults])
  }

  function removeItem(index: number) {
    if (items.length <= minItems) return
    const next = [...items]
    next.splice(index, 1)
    onChange(next)
  }

  function moveItem(from: number, to: number) {
    if (to < 0 || to >= items.length) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  function updateItem(index: number, fieldName: string, fieldValue: unknown) {
    const next = [...items]
    next[index] = { ...next[index], [fieldName]: fieldValue }
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

      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              'rounded-lg border border-input bg-background p-4',
              hasError && 'border-destructive',
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Item {index + 1}
              </span>

              <div className="flex items-center gap-1">
                {reorderable && (
                  <>
                    <button
                      type="button"
                      onClick={() => moveItem(index, index - 1)}
                      disabled={index === 0 || schema.disabled}
                      className="rounded p-1 hover:bg-muted disabled:opacity-50"
                    >
                      <Icon name="chevron-up" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(index, index + 1)}
                      disabled={index === items.length - 1 || schema.disabled}
                      className="rounded p-1 hover:bg-muted disabled:opacity-50"
                    >
                      <Icon name="chevron-down" className="h-4 w-4" />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length <= minItems || schema.disabled}
                  className="rounded p-1 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Icon name="trash-2" className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {childSchema.map((comp) => {
                const Component = resolveComponent(comp.type)
                if (!Component || comp.hidden) return null
                return (
                  <Component
                    key={comp.name}
                    schema={comp}
                    value={item[comp.name] ?? comp.default ?? ''}
                    onChange={(val: unknown) => updateItem(index, comp.name, val)}
                  />
                )
              })}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addItem}
          disabled={schema.disabled || (maxItems !== undefined && items.length >= maxItems)}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-input py-3 text-sm text-muted-foreground transition-colors',
            'hover:border-muted-foreground/50 hover:text-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <Icon name="plus" className="h-4 w-4" />
          {addLabel}
        </button>
      </div>

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
