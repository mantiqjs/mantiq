import { useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { usePanel } from '@/hooks/usePanel'
import { useRouter } from '@/hooks/useRouter'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import type { BreadcrumbItem } from '@/components/layout/Breadcrumbs'

// ── Types ────────────────────────────────────────────────────────────────────

interface PanelLayoutProps {
  children: ReactNode
}

// ── Max width mapping ────────────────────────────────────────────────────────

const MAX_WIDTH_CLASSES: Record<string, string> = {
  full: 'max-w-full',
  '7xl': 'max-w-7xl',
  '6xl': 'max-w-6xl',
  '5xl': 'max-w-5xl',
  '4xl': 'max-w-4xl',
  '3xl': 'max-w-3xl',
  '2xl': 'max-w-2xl',
  xl: 'max-w-xl',
  lg: 'max-w-lg',
}

// ── Component ────────────────────────────────────────────────────────────────

export function PanelLayout({ children }: PanelLayoutProps) {
  const { panel } = usePanel()
  const { pathname, navigate, match } = useRouter()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const toggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => !prev)
  }, [])

  const toggleMobileSidebar = useCallback(() => {
    setMobileSidebarOpen((prev) => !prev)
  }, [])

  // Build breadcrumbs from current route
  const breadcrumbs = useMemo((): BreadcrumbItem[] => {
    if (!panel || !match) return [{ label: 'Dashboard' }]

    const basePath = panel.path

    const items: BreadcrumbItem[] = [{ label: 'Home', href: basePath }]

    if (match.params.slug) {
      const resource = panel.resources.find((r) => r.slug === match.params.slug)
      const label = resource?.label ?? match.params.slug

      if (match.pattern === '/resources/:slug') {
        items.push({ label })
      } else if (match.pattern === '/resources/:slug/create') {
        items.push({
          label,
          href: `${basePath}/resources/${match.params.slug}`,
        })
        items.push({ label: 'Create' })
      } else if (match.pattern === '/resources/:slug/:id/edit') {
        items.push({
          label,
          href: `${basePath}/resources/${match.params.slug}`,
        })
        items.push({ label: `Edit #${match.params.id}` })
      }
    }

    return items
  }, [panel, match])

  if (!panel) return null

  // Prepend panel path to navigation URLs so sidebar hrefs are correct
  const prefixedNavigation = panel.navigation.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      url: item.url.startsWith(panel.path) ? item.url : panel.path + item.url,
      children: item.children?.map((child) => ({
        ...child,
        url: child.url.startsWith(panel.path) ? child.url : panel.path + child.url,
      })) ?? [],
    })),
  }))

  const maxWidthClass = MAX_WIDTH_CLASSES[panel.maxContentWidth] ?? 'max-w-7xl'

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 lg:hidden',
          'transition-transform duration-200',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar
          brandName={panel.brandName}
          brandLogo={panel.brandLogo}
          navigation={prefixedNavigation}
          sidebarCollapsible={false}
          collapsed={false}
          onToggleCollapse={() => {}}
          currentPath={pathname}
          navigate={(to) => {
            navigate(to)
            setMobileSidebarOpen(false)
          }}
        />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          brandName={panel.brandName}
          brandLogo={panel.brandLogo}
          navigation={prefixedNavigation}
          sidebarCollapsible={panel.sidebarCollapsible}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
          currentPath={pathname}
          navigate={navigate}
        />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          breadcrumbs={breadcrumbs}
          globalSearchEnabled={panel.globalSearchEnabled}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebarCollapse}
          onToggleMobileSidebar={toggleMobileSidebar}
          navigate={navigate}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className={cn('mx-auto w-full px-4 py-6 lg:px-8', maxWidthClass)}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
