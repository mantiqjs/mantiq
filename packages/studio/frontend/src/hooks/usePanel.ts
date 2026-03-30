import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { api } from '@/api/client'
import { createElement } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export interface NavigationItemConfig {
  label: string
  icon: string | undefined
  url: string
  badge: string | number | undefined
  badgeColor: string | undefined
  isActive: boolean
  children: NavigationItemConfig[]
}

export interface NavigationGroupConfig {
  label: string
  icon: string | undefined
  collapsible: boolean
  items: NavigationItemConfig[]
}

export interface ResourceConfig {
  slug: string
  label: string
  navigationIcon: string
  navigationGroup: string
  navigationSort: number
  recordTitleAttribute: string
  globallySearchable: boolean
  softDeletes: boolean
  form: unknown
  table: unknown
}

export interface PanelConfig {
  id: string
  path: string
  brandName: string
  brandLogo: string | undefined
  favicon: string | undefined
  darkMode: boolean
  colors: Record<string, string>
  maxContentWidth: string
  sidebarCollapsible: boolean
  globalSearchEnabled: boolean
  navigation: NavigationGroupConfig[]
  resources: ResourceConfig[]
}

export interface PanelContextValue {
  panel: PanelConfig | null
  loading: boolean
  error: string | null
  refetch: () => void
}

// ── Context ──────────────────────────────────────────────────────────────────

const PanelContext = createContext<PanelContextValue>({
  panel: null,
  loading: true,
  error: null,
  refetch: () => {},
})

// ── Provider ─────────────────────────────────────────────────────────────────

interface PanelProviderProps {
  children: ReactNode
}

export function PanelProvider({ children }: PanelProviderProps) {
  const [panel, setPanel] = useState<PanelConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPanel = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await api.get<PanelConfig>('/panel')
      setPanel(data)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load panel configuration'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPanel()
  }, [fetchPanel])

  const value: PanelContextValue = { panel, loading, error, refetch: fetchPanel }

  return createElement(PanelContext.Provider, { value }, children)
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePanel(): PanelContextValue {
  return useContext(PanelContext)
}
