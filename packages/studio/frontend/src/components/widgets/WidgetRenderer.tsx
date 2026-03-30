import { StatsWidget } from '@/components/widgets/StatsWidget'
import type { WidgetSchema } from '@/components/forms/types'

export interface WidgetRendererProps {
  schema: WidgetSchema
}

export function WidgetRenderer({ schema }: WidgetRendererProps) {
  switch (schema.type) {
    case 'stats':
      return <StatsWidget schema={schema} />

    default:
      return (
        <div className="rounded-lg border border-input bg-card p-6 text-sm text-muted-foreground">
          Unknown widget type: <code>{schema.type}</code>
        </div>
      )
  }
}
