import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import type { FormComponentSchema } from '@/components/forms/types'

export interface SelectProps {
  schema: FormComponentSchema & {
    options?: Record<string, string> | null
    relationship?: string
    searchable?: boolean
    multiple?: boolean
    preload?: boolean
    native?: boolean
  }
  value: string | string[]
  onChange: (value: string | string[]) => void
  error?: string[]
}

export function Select({ schema, value, onChange, error }: SelectProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const hasError = error && error.length > 0
  const options = schema.options ?? {}
  const isMultiple = schema.multiple ?? false

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredOptions = Object.entries(options).filter(([, label]) =>
    !searchQuery || label.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const selectedValues = isMultiple
    ? (Array.isArray(value) ? value : value ? [value] : [])
    : []
  const selectedValue = isMultiple ? '' : (value as string) ?? ''

  function getDisplayLabel(): string {
    if (isMultiple) {
      if (selectedValues.length === 0) return schema.placeholder ?? 'Select...'
      return selectedValues.map((v) => options[v] ?? v).join(', ')
    }
    if (!selectedValue) return schema.placeholder ?? 'Select...'
    return options[selectedValue] ?? selectedValue
  }

  function handleSelect(key: string) {
    if (isMultiple) {
      const current = [...selectedValues]
      const index = current.indexOf(key)
      if (index >= 0) {
        current.splice(index, 1)
      } else {
        current.push(key)
      }
      onChange(current)
    } else {
      onChange(key)
      setOpen(false)
    }
  }

  // Native select for simple cases
  if (schema.native) {
    return (
      <div className="space-y-2">
        {schema.label && (
          <label className="text-sm font-medium leading-none">
            {schema.label}
            {schema.required && <span className="text-destructive ml-1">*</span>}
          </label>
        )}

        <select
          value={isMultiple ? selectedValues : selectedValue}
          multiple={isMultiple}
          onChange={(e) => {
            if (isMultiple) {
              const selected = Array.from(e.target.selectedOptions, (opt) => opt.value)
              onChange(selected)
            } else {
              onChange(e.target.value)
            }
          }}
          disabled={schema.disabled}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            hasError && 'border-destructive focus-visible:ring-destructive',
          )}
        >
          {!isMultiple && (
            <option value="">{schema.placeholder ?? 'Select...'}</option>
          )}
          {Object.entries(options).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

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

  return (
    <div className="space-y-2" ref={dropdownRef}>
      {schema.label && (
        <label className="text-sm font-medium leading-none">
          {schema.label}
          {schema.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => !schema.disabled && setOpen(!open)}
          disabled={schema.disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !selectedValue && !selectedValues.length && 'text-muted-foreground',
            hasError && 'border-destructive focus-visible:ring-destructive',
          )}
        >
          <span className="truncate">{getDisplayLabel()}</span>
          <Icon name="chevron-down" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-popover shadow-md">
            {schema.searchable && (
              <div className="p-2 border-b border-input">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  autoFocus
                />
              </div>
            )}

            <div className="max-h-60 overflow-auto p-1">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No options found.
                </div>
              ) : (
                filteredOptions.map(([key, label]) => {
                  const isSelected = isMultiple
                    ? selectedValues.includes(key)
                    : selectedValue === key
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => handleSelect(key)}
                      className={cn(
                        'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
                        'hover:bg-accent hover:text-accent-foreground',
                        isSelected && 'bg-accent text-accent-foreground',
                      )}
                    >
                      {isMultiple && (
                        <span className={cn(
                          'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                          isSelected && 'bg-primary text-primary-foreground',
                        )}>
                          {isSelected && <Icon name="check" className="h-3 w-3" />}
                        </span>
                      )}
                      <span>{label}</span>
                      {!isMultiple && isSelected && (
                        <Icon name="check" className="ml-auto h-4 w-4" />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
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
