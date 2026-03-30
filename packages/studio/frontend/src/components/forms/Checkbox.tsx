import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import type { FormComponentSchema } from '@/components/forms/types'

export interface CheckboxProps {
  schema: FormComponentSchema & {
    inline?: boolean
  }
  value: boolean
  onChange: (value: boolean) => void
  error?: string[]
}

export function Checkbox({ schema, value, onChange, error }: CheckboxProps) {
  const checked = !!value
  const hasError = error && error.length > 0

  return (
    <div className="space-y-2">
      <div className={cn('flex gap-2', schema.inline ? 'items-center' : 'items-start')}>
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          disabled={schema.disabled}
          onClick={() => onChange(!checked)}
          className={cn(
            'h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            checked && 'bg-primary text-primary-foreground',
          )}
        >
          {checked && (
            <span className="flex items-center justify-center">
              <Icon name="check" className="h-3 w-3" />
            </span>
          )}
        </button>

        {schema.label && (
          <label
            className="text-sm font-medium leading-none cursor-pointer"
            onClick={() => !schema.disabled && onChange(!checked)}
          >
            {schema.label}
            {schema.required && <span className="text-destructive ml-1">*</span>}
          </label>
        )}
      </div>

      {schema.helperText && !hasError && (
        <p className="text-sm text-muted-foreground ml-6">{schema.helperText}</p>
      )}

      {hasError && (
        <div className="space-y-1 ml-6">
          {error.map((msg, i) => (
            <p key={i} className="text-sm text-destructive">{msg}</p>
          ))}
        </div>
      )}
    </div>
  )
}
