import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import { useTheme } from '@/theme/ThemeProvider'
import type { BreadcrumbItem } from '@/components/layout/Breadcrumbs'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

// ── Types ────────────────────────────────────────────────────────────────────

interface TopbarProps {
  breadcrumbs: BreadcrumbItem[]
  globalSearchEnabled: boolean
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onToggleMobileSidebar: () => void
  navigate: (to: string) => void
}

// ── Component ────────────────────────────────────────────────────────────────

export function Topbar({
  breadcrumbs,
  globalSearchEnabled,
  sidebarCollapsed,
  onToggleSidebar,
  onToggleMobileSidebar,
  navigate,
}: TopbarProps) {
  const { resolvedTheme, toggleTheme } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background px-4 lg:px-6">
      {/* Mobile sidebar toggle */}
      <button
        onClick={onToggleMobileSidebar}
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
        aria-label="Toggle sidebar"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      {/* Desktop sidebar toggle (when sidebar is collapsed) */}
      {sidebarCollapsed && (
        <button
          onClick={onToggleSidebar}
          className="hidden rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:block"
          aria-label="Expand sidebar"
        >
          <Icon name="panel-left-open" className="h-5 w-5" />
        </button>
      )}

      {/* Breadcrumbs */}
      <div className="hidden flex-1 md:block">
        <Breadcrumbs items={breadcrumbs} navigate={navigate} />
      </div>

      {/* Spacer for mobile */}
      <div className="flex-1 md:hidden" />

      {/* Right side actions */}
      <div className="flex items-center gap-1">
        {/* Global search */}
        {globalSearchEnabled && (
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Search"
          >
            <Icon name="search" className="h-5 w-5" />
          </button>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label={
            resolvedTheme === 'dark'
              ? 'Switch to light mode'
              : 'Switch to dark mode'
          }
        >
          {resolvedTheme === 'dark' ? (
            <Icon name="sun" className="h-5 w-5" />
          ) : (
            <Icon name="moon" className="h-5 w-5" />
          )}
        </button>

        {/* User menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 rounded-md p-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="User menu"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Icon name="user" className="h-4 w-4" />
            </div>
          </button>

          {/* Dropdown */}
          {userMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">Admin User</p>
                <p className="text-xs text-muted-foreground">
                  admin@example.com
                </p>
              </div>
              <div className="my-1 h-px bg-border" />
              <button
                onClick={() => {
                  setUserMenuOpen(false)
                  window.location.href = '/logout'
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive transition-colors hover:bg-accent"
              >
                <Icon name="log-out" className="h-4 w-4" />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search overlay */}
      {searchOpen && globalSearchEnabled && (
        <SearchOverlay
          onClose={() => setSearchOpen(false)}
          navigate={navigate}
        />
      )}
    </header>
  )
}

// ── Search Overlay ───────────────────────────────────────────────────────────

interface SearchOverlayProps {
  onClose: () => void
  navigate: (to: string) => void
}

function SearchOverlay({ onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Search dialog */}
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-popover p-0 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Icon
            name="search"
            className="h-5 w-5 shrink-0 text-muted-foreground"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              ESC
            </kbd>
          </button>
        </div>

        {/* Results placeholder */}
        {query && (
          <div className="max-h-80 overflow-y-auto p-2">
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Type to search across all resources...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
