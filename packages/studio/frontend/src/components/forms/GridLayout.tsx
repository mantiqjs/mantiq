import { resolveComponent } from '@/components/registry'
import type { FormComponentSchema } from '@/components/forms/types'

export interface GridLayoutProps {
  schema: FormComponentSchema & {
    schema?: FormComponentSchema[]
    columns?: number
  }
  value: Record<string, unknown>
  onChange: (name: string, value: unknown) => void
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

export function GridLayout({ schema, value, onChange, errors }: GridLayoutProps) {
  const children = schema.schema ?? []
  const columns = schema.columns ?? 2

  const gridClass = GRID_CLASSES[columns] ?? `grid-cols-${columns}`

  return (
    <div className={`grid ${gridClass} gap-4`}>
      {children.map((comp) => {
        const Component = resolveComponent(comp.type)
        if (!Component || comp.hidden) return null

        const spanClass = comp.columnSpan
          ? (SPAN_CLASSES[comp.columnSpan] ?? `col-span-${comp.columnSpan}`)
          : ''

        return (
          <div key={comp.name} className={spanClass}>
            <Component
              schema={comp}
              value={value?.[comp.name] ?? comp.default ?? ''}
              onChange={(val: unknown) => onChange(comp.name, val)}
              error={errors?.[comp.name]}
              errors={errors}
            />
          </div>
        )
      })}
    </div>
  )
}
