import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import { FormRenderer } from '@/components/forms/FormRenderer'
import type { ResourceSchema, FormSchema } from '@/components/forms/types'

export interface CreatePageProps {
  resource: ResourceSchema
  basePath: string
  onNavigate: (path: string) => void
}

export function CreatePage({ resource, basePath, onNavigate }: CreatePageProps) {
  const [schema, setSchema] = useState<FormSchema | null>(null)
  const [loading, setLoading] = useState(false)
  const [schemaLoading, setSchemaLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [schemaError, setSchemaError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSchema() {
      setSchemaLoading(true)
      try {
        const res = await fetch(`${basePath}/api/resources/${resource.slug}/schema`)
        if (!res.ok) throw new Error('Failed to fetch schema')
        const json = await res.json()
        setSchema(json.form)
      } catch {
        // Fall back to resource.form
        if (resource.form.components.length > 0) {
          setSchema(resource.form)
        } else {
          setSchemaError('Could not load form schema.')
        }
      } finally {
        setSchemaLoading(false)
      }
    }
    fetchSchema()
  }, [basePath, resource.slug, resource.form])

  async function handleSubmit(data: Record<string, any>) {
    setLoading(true)
    setErrors({})

    try {
      const res = await fetch(`${basePath}/api/resources/${resource.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.status === 422) {
        const json = await res.json()
        setErrors(json.errors ?? {})
        return
      }

      if (!res.ok) {
        throw new Error('Failed to create record')
      }

      // Success — navigate back to list
      onNavigate(`/resources/${resource.slug}`)
    } catch (err) {
      setErrors({
        _global: [err instanceof Error ? err.message : 'An unexpected error occurred.'],
      })
    } finally {
      setLoading(false)
    }
  }

  if (schemaLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Icon name="loader-2" className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (schemaError || !schema) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {schemaError ?? 'Failed to load form schema.'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onNavigate(`/resources/${resource.slug}`)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Icon name="arrow-left" className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Create {resource.label.replace(/s$/, '')}
          </h1>
        </div>
      </div>

      {/* Global error */}
      {errors._global && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errors._global.map((msg, i) => (
            <p key={i}>{msg}</p>
          ))}
        </div>
      )}

      {/* Form */}
      <div className="rounded-lg border border-input bg-card p-6">
        <FormRenderer
          schema={schema}
          onSubmit={handleSubmit}
          onCancel={() => onNavigate(`/resources/${resource.slug}`)}
          submitLabel="Create"
          loading={loading}
          errors={errors}
        />
      </div>
    </div>
  )
}
