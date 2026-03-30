import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/api/client'

// ── Types ────────────────────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number
  currentPage: number
  perPage: number
  lastPage: number
  from: number
  to: number
}

export interface ResourceListResponse {
  data: Record<string, unknown>[]
  meta: PaginationMeta
}

export interface UseResourceState {
  data: Record<string, unknown>[]
  meta: PaginationMeta | null
  loading: boolean
  error: string | null
  search: string
  setSearch: (value: string) => void
  page: number
  setPage: (page: number) => void
  perPage: number
  setPerPage: (perPage: number) => void
  sortField: string | null
  sortDirection: 'asc' | 'desc'
  setSort: (field: string) => void
  filters: Record<string, string>
  setFilter: (field: string, value: string) => void
  clearFilters: () => void
  refetch: () => void
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useResource(slug: string): UseResourceState {
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [filters, setFilters] = useState<Record<string, string>>({})

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      // Reset to page 1 when search changes
      setPage(1)
    }, 300)

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
      }
    }
  }, [search])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params: Record<string, string> = {
        page: String(page),
        perPage: String(perPage),
      }

      if (debouncedSearch) {
        params.search = debouncedSearch
      }

      if (sortField) {
        params.sort = sortField
        params.direction = sortDirection
      }

      // Add filters as filter[name]=value
      for (const [key, value] of Object.entries(filters)) {
        if (value !== '') {
          params[`filter[${key}]`] = value
        }
      }

      const response = await api.get<ResourceListResponse>(
        `/resources/${slug}`,
        params,
      )

      setData(response.data)
      setMeta(response.meta)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load resource data'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [slug, page, perPage, debouncedSearch, sortField, sortDirection, filters])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset state when slug changes
  useEffect(() => {
    setData([])
    setMeta(null)
    setSearch('')
    setPage(1)
    setSortField(null)
    setSortDirection('asc')
    setFilters({})
  }, [slug])

  const setSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        // Toggle direction
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField(field)
        setSortDirection('asc')
      }
    },
    [sortField],
  )

  const setFilter = useCallback((field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setPage(1)
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({})
    setPage(1)
  }, [])

  return {
    data,
    meta,
    loading,
    error,
    search,
    setSearch,
    page,
    setPage,
    perPage,
    setPerPage,
    sortField,
    sortDirection,
    setSort,
    filters,
    setFilter,
    clearFilters,
    refetch: fetchData,
  }
}
