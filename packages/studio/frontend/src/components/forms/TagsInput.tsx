import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import type { FormComponentSchema } from '@/components/forms/types'

export interface TagsInputProps {
  schema: FormComponentSchema & {
    suggestions?: string[]
    separator?: string
  }
  value: string[]
  onChange: (value: string[]) => void
  error?: string[]
}

export function TagsInput({ schema, value, onChange, error }: TagsInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasError = error && error.length > 0
  const tags = Array.isArray(value) ? value : []
  const separator = schema.separator ?? ','
  const suggestions = schema.suggestions ?? []

  const filteredSuggestions = suggestions.filter(
    (s) =>
      s.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(s),
  )

  function addTag(tag: string) {
    const trimmed = tag.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
    setInputValue('')
    setShowSuggestions(false)
  }

  function removeTag(index: number) {
    const next = [...tags]
    next.splice(index, 1)
    onChange(next)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === separator) {
      e.preventDefault()
      if (inputValue.trim()) {
        addTag(inputValue)
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  return (
    <div className="space-y-2">
      {schema.label && (
        <label className="text-sm font-medium leading-none">
          {schema.label}
          {schema.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <div
          className={cn(
            'flex min-h-[40px] w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
            schema.disabled && 'cursor-not-allowed opacity-50',
            hasError && 'border-destructive focus-within:ring-destructive',
          )}
          onClick={() => inputRef.current?.focus()}
        >
          {tags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-sm font-medium text-secondary-foreground"
            >
              {tag}
              {!schema.disabled && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeTag(i) }}
                  className="ml-0.5 rounded-sm hover:bg-secondary-foreground/20"
                >
                  <Icon name="x" className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}

          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              setShowSuggestions(true)
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              // Delay to allow click on suggestion
              setTimeout(() => setShowSuggestions(false), 200)
            }}
            placeholder={tags.length === 0 ? (schema.placeholder ?? 'Type and press Enter...') : ''}
            disabled={schema.disabled}
            className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>

        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-popover shadow-md">
            <div className="max-h-40 overflow-auto p-1">
              {filteredSuggestions.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => addTag(suggestion)}
                  className="flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  {suggestion}
                </button>
              ))}
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
