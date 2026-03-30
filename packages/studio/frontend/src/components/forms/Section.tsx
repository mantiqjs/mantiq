import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import { resolveComponent } from '@/components/registry'
import type { FormComponentSchema } from '@/components/forms/types'

export interface SectionProps {
  schema: FormComponentSchema & {
    heading?: string
    description?: string
    schema?: FormComponentSchema[]
    collapsible?: boolean
    collapsed?: boolean
    aside?: boolean
    icon?: string
  }
  value: Record<string, unknown>
  onChange: (name: string, value: unknown) => void
  errors?: Record<string, string[]>
}

export function Section({ schema, value, onChange, errors }: SectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(schema.collapsed ?? false)
  const children = schema.schema ?? []
  const collapsible = schema.collapsible ?? false

  return (
    <div className={cn(
      'rounded-lg border border-input bg-card',
      schema.aside && 'lg:col-span-1',
    )}>
      {(schema.heading || schema.description) && (
        <div
          className={cn(
            'flex items-center gap-3 border-b border-input px-6 py-4',
            collapsible && 'cursor-pointer select-none',
          )}
          onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
        >
          {schema.icon && (
            <Icon name={schema.icon} className="h-5 w-5 text-muted-foreground" />
          )}

          <div className="flex-1">
            {schema.heading && (
              <h3 className="text-base font-semibold">{schema.heading}</h3>
            )}
            {schema.description && (
              <p className="mt-1 text-sm text-muted-foreground">{schema.description}</p>
            )}
          </div>

          {collapsible && (
            <Icon
              name={isCollapsed ? 'chevron-down' : 'chevron-up'}
              className="h-4 w-4 text-muted-foreground"
            />
          )}
        </div>
      )}

      {!isCollapsed && (
        <div className="space-y-4 p-6">
          {children.map((comp) => {
            const Component = resolveComponent(comp.type)
            if (!Component || comp.hidden) return null
            return (
              <Component
                key={comp.name}
                schema={comp}
                value={value?.[comp.name] ?? comp.default ?? ''}
                onChange={(val: unknown) => onChange(comp.name, val)}
                error={errors?.[comp.name]}
                errors={errors}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
