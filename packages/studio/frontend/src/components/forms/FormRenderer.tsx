import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { resolveComponent } from '@/components/registry'
import { Icon } from '@/components/Icon'
import type { FormSchema, FormComponentSchema } from '@/components/forms/types'

export interface FormRendererProps {
  schema: FormSchema
  data?: Record<string, any>
  onSubmit: (data: Record<string, any>) => void
  onCancel?: () => void
  submitLabel?: string
  loading?: boolean
  errors?: Record<string, string[]>
}

const GRID_CLASSES: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
}

const SPAN_CLASSES: Record<number, string> = {
  1: 'col-span-1',
  2: 'sm:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
}

export function FormRenderer({
  schema,
  data,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  loading = false,
  errors,
}: FormRendererProps) {
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = { ...data }
    // Set defaults for fields not present in data
    for (const comp of schema.components) {
      if (!(comp.name in initial) && comp.default !== undefined) {
        initial[comp.name] = comp.default
      }
    }
    return initial
  })

  const updateField = useCallback((name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(formData)
  }

  function isLayoutComponent(type: string): boolean {
    return ['section', 'tabs', 'grid', 'wizard'].includes(type)
  }

  function renderComponent(comp: FormComponentSchema) {
    if (comp.hidden) return null

    const Component = resolveComponent(comp.type)
    if (!Component) {
      return (
        <div key={comp.name} className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Unknown component type: <code>{comp.type}</code>
        </div>
      )
    }

    if (isLayoutComponent(comp.type)) {
      // Layout components receive the full formData and a field-level onChange
      return (
        <Component
          key={comp.name || comp.type}
          schema={comp}
          value={formData}
          onChange={updateField}
          errors={errors}
        />
      )
    }

    return (
      <Component
        key={comp.name}
        schema={comp}
        value={formData[comp.name] ?? comp.default ?? ''}
        onChange={(val: unknown) => updateField(comp.name, val)}
        error={errors?.[comp.name]}
      />
    )
  }

  const gridClass = GRID_CLASSES[schema.columns] ?? 'grid-cols-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className={cn('grid gap-6', gridClass)}>
        {schema.components.map((comp) => {
          const isLayout = isLayoutComponent(comp.type)
          const spanClass = isLayout
            ? `col-span-full`
            : comp.columnSpan
              ? (SPAN_CLASSES[comp.columnSpan] ?? `col-span-${comp.columnSpan}`)
              : ''

          return (
            <div key={comp.name || comp.type} className={spanClass}>
              {renderComponent(comp)}
            </div>
          )
        })}
      </div>

      {/* Form actions */}
      <div className="flex items-center justify-end gap-3 border-t border-input pt-6">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className={cn(
              'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors',
              'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          disabled={loading}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {loading && (
            <Icon name="loader-2" className="h-4 w-4 animate-spin" />
          )}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
