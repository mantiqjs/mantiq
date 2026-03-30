import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/Icon'
import type { NavigationGroupConfig, NavigationItemConfig } from '@/hooks/usePanel'

// ── Types ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  brandName: string
  brandLogo: string | undefined
  navigation: NavigationGroupConfig[]
  sidebarCollapsible: boolean
  collapsed: boolean
  onToggleCollapse: () => void
  currentPath: string
  navigate: (to: string) => void
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({
  brandName,
  brandLogo,
  navigation,
  sidebarCollapsible,
  collapsed,
  onToggleCollapse,
  currentPath,
  navigate,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        collapsed ? 'w-[4.5rem]' : 'w-64',
      )}
    >
      {/* Brand header */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-sidebar-border px-4',
          collapsed ? 'justify-center' : 'gap-3',
        )}
      >
        {brandLogo ? (
          <img
            src={brandLogo}
            alt={brandName}
            className={cn('h-8 w-auto', collapsed && 'h-7')}
          />
        ) : (
          <>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <span className="text-sm font-bold">
                {brandName.charAt(0).toUpperCase()}
              </span>
            </div>
            {!collapsed && (
              <span className="truncate text-sm font-semibold">{brandName}</span>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-6">
          {navigation.map((group, groupIndex) => (
            <NavigationGroupSection
              key={groupIndex}
              group={group}
              collapsed={collapsed}
              currentPath={currentPath}
              navigate={navigate}
            />
          ))}
        </div>
      </nav>

      {/* Collapse toggle */}
      {sidebarCollapsible && (
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <button
            onClick={onToggleCollapse}
            className={cn(
              'flex w-full items-center rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              collapsed ? 'justify-center' : 'gap-3',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon
              name={collapsed ? 'panel-left-open' : 'panel-left-close'}
              className="h-4 w-4 shrink-0"
            />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      )}
    </aside>
  )
}

// ── Navigation Group ─────────────────────────────────────────────────────────

interface NavigationGroupSectionProps {
  group: NavigationGroupConfig
  collapsed: boolean
  currentPath: string
  navigate: (to: string) => void
}

function NavigationGroupSection({
  group,
  collapsed,
  currentPath,
  navigate,
}: NavigationGroupSectionProps) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div>
      {/* Group label -- only show when sidebar is expanded */}
      {!collapsed && group.label && (
        <div className="mb-1 flex items-center gap-2 px-2">
          {group.collapsible ? (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex w-full items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              <Icon
                name={isOpen ? 'chevron-down' : 'chevron-right'}
                className="h-3 w-3"
              />
              <span>{group.label}</span>
            </button>
          ) : (
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {group.label}
            </span>
          )}
        </div>
      )}

      {/* Group items */}
      {(isOpen || collapsed) && (
        <ul className="space-y-0.5">
          {group.items.map((item, itemIndex) => (
            <NavigationItemRow
              key={itemIndex}
              item={item}
              collapsed={collapsed}
              currentPath={currentPath}
              navigate={navigate}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Navigation Item ──────────────────────────────────────────────────────────

interface NavigationItemRowProps {
  item: NavigationItemConfig
  collapsed: boolean
  currentPath: string
  navigate: (to: string) => void
  depth?: number
}

function NavigationItemRow({
  item,
  collapsed,
  currentPath,
  navigate,
  depth = 0,
}: NavigationItemRowProps) {
  const [childrenOpen, setChildrenOpen] = useState(false)
  const isActive = currentPath === item.url || currentPath.startsWith(item.url + '/')
  const hasChildren = item.children && item.children.length > 0

  return (
    <li>
      <a
        href={item.url}
        onClick={(e) => {
          e.preventDefault()
          if (hasChildren) {
            setChildrenOpen(!childrenOpen)
          } else {
            navigate(item.url)
          }
        }}
        title={collapsed ? item.label : undefined}
        className={cn(
          'group flex items-center rounded-md px-2 py-2 text-sm font-medium transition-colors',
          collapsed ? 'justify-center' : 'gap-3',
          depth > 0 && !collapsed && 'ml-4',
          isActive
            ? 'bg-sidebar-accent text-sidebar-primary'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        )}
      >
        {/* Icon */}
        {item.icon && (
          <Icon
            name={item.icon}
            className={cn(
              'h-4 w-4 shrink-0',
              isActive
                ? 'text-sidebar-primary'
                : 'text-muted-foreground group-hover:text-sidebar-accent-foreground',
            )}
          />
        )}

        {/* Label */}
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>

            {/* Badge */}
            {item.badge !== undefined && item.badge !== null && (
              <span
                className={cn(
                  'ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-medium',
                  item.badgeColor
                    ? 'text-white'
                    : 'bg-sidebar-accent text-sidebar-accent-foreground',
                )}
                style={
                  item.badgeColor ? { backgroundColor: item.badgeColor } : undefined
                }
              >
                {item.badge}
              </span>
            )}

            {/* Expand chevron for items with children */}
            {hasChildren && (
              <Icon
                name={childrenOpen ? 'chevron-down' : 'chevron-right'}
                className="h-3.5 w-3.5 text-muted-foreground"
              />
            )}
          </>
        )}
      </a>

      {/* Children */}
      {hasChildren && childrenOpen && !collapsed && (
        <ul className="mt-0.5 space-y-0.5">
          {item.children.map((child, childIndex) => (
            <NavigationItemRow
              key={childIndex}
              item={child}
              collapsed={collapsed}
              currentPath={currentPath}
              navigate={navigate}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
