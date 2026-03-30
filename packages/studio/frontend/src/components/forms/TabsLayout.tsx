import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import { resolveComponent } from '@/components/registry'
import type { FormComponentSchema } from '@/components/forms/types'

interface TabDefinition {
  label: string
  icon?: string
  badge?: string
  schema: FormComponentSchema[]
}

export interface TabsLayoutProps {
  schema: FormComponentSchema & {
    tabs?: TabDefinition[]
  }
  value: Record<string, unknown>
  onChange: (name: string, value: unknown) => void
  errors?: Record<string, string[]>
}

export function TabsLayout({ schema, value, onChange, errors }: TabsLayoutProps) {
  const tabs = schema.tabs ?? []
  const [activeTab, setActiveTab] = useState(0)

  if (tabs.length === 0) return null

  const currentTab = tabs[activeTab]

  return (
    <div className="space-y-4">
      {/* Tab headers */}
      <div className="border-b border-input">
        <div className="flex gap-0 -mb-px">
          {tabs.map((tab, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveTab(index)}
              className={cn(
                'inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                index === activeTab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground',
              )}
            >
              {tab.icon && <Icon name={tab.icon} className="h-4 w-4" />}
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="ml-1.5 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Active tab content */}
      {currentTab && (
        <div className="space-y-4">
          {currentTab.schema.map((comp) => {
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
