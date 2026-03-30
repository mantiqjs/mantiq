import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import { FormRenderer } from '@/components/forms/FormRenderer'
import { DeleteConfirmation } from '@/components/actions/DeleteConfirmation'
import type { ResourceSchema, FormSchema } from '@/components/forms/types'

export interface EditPageProps {
  resource: ResourceSchema
  recordId: number | string
  basePath: string
  onNavigate: (path: string) => void
}

export function EditPage({ resource, recordId, basePath, onNavigate }: EditPageProps) {
  const [schema, setSchema] = useState<FormSchema | null>(null)
  const [record, setRecord] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [pageError, setPageError] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setPageLoading(true)
      setPageError(null)

      try {
        // Fetch schema and record in parallel
        const [schemaRes, recordRes] = await Promise.all([
          fetch(`${basePath}/api/resources/${resource.slug}/schema`),
          fetch(`${basePath}/api/resources/${resource.slug}/${recordId}`),
        ])

        if (!recordRes.ok) {
          if (recordRes.status === 404) {
            setPageError('Record not found.')
          } else {
            throw new Error('Failed to fetch record')
          }
          return
        }

        const recordJson = await recordRes.json()
        setRecord(recordJson.data)

        if (schemaRes.ok) {
          const schemaJson = await schemaRes.json()
          setSchema(schemaJson.form)
        } else if (resource.form.components.length > 0) {
          setSchema(resource.form)
        } else {
          setPageError('Could not load form schema.')
        }
      } catch (err) {
        setPageError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setPageLoading(false)
      }
    }
    fetchData()
  }, [basePath, resource.slug, resource.form, recordId])

  async function handleSubmit(data: Record<string, any>) {
    setLoading(true)
    setErrors({})

    try {
      const res = await fetch(`${basePath}/api/resources/${resource.slug}/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.status === 422) {
        const json = await res.json()
        setErrors(json.errors ?? {})
        return
      }

      if (!res.ok) {
        throw new Error('Failed to update record')
      }

      // Success — navigate back to list
      onNavigate(`/${resource.slug}`)
    } catch (err) {
      setErrors({
        _global: [err instanceof Error ? err.message : 'An unexpected error occurred.'],
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setDeleteLoading(true)
    try {
      const res = await fetch(`${basePath}/api/resources/${resource.slug}/${recordId}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete record')

      onNavigate(`/${resource.slug}`)
    } catch {
      // Error handling
    } finally {
      setDeleteLoading(false)
      setShowDelete(false)
    }
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Icon name="loader-2" className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (pageError) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => onNavigate(`/${resource.slug}`)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon name="arrow-left" className="h-4 w-4" />
          Back to {resource.label}
        </button>

        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {pageError}
        </div>
      </div>
    )
  }

  if (!schema || !record) return null

  const recordTitle = record[resource.recordTitleAttribute] ?? `#${recordId}`

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onNavigate(`/${resource.slug}`)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Icon name="arrow-left" className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Edit {recordTitle}
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDelete(true)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            'border border-destructive/30 text-destructive hover:bg-destructive/10',
          )}
        >
          <Icon name="trash-2" className="h-4 w-4" />
          Delete
        </button>
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
          data={record}
          onSubmit={handleSubmit}
          onCancel={() => onNavigate(`/${resource.slug}`)}
          submitLabel="Save changes"
          loading={loading}
          errors={errors}
        />
      </div>

      {/* Delete confirmation */}
      <DeleteConfirmation
        open={showDelete}
        title={`Delete ${recordTitle}`}
        description={`Are you sure you want to delete this ${resource.label.replace(/s$/, '').toLowerCase()}? This action cannot be undone.`}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  )
}
