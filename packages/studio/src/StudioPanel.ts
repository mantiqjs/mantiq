import type { Container } from '@mantiq/core'
import type { Resource } from './resources/Resource.ts'
import type { NavigationGroup } from './navigation/NavigationGroup.ts'

/**
 * Abstract panel class -- the entry point for a Studio admin panel.
 *
 * Each panel serves its own React SPA at a configurable URL path,
 * with its own set of resources, widgets, pages, and theme.
 *
 * Multiple panels can coexist (admin, customer portal, partner dashboard),
 * each with its own access gate but sharing the same auth infrastructure.
 */
export abstract class StudioPanel {
  /** URL prefix for this panel. Must be unique across panels. */
  path: string = '/admin'

  /** Brand name shown in the sidebar header. */
  brandName: string = 'Studio'

  /** Optional brand logo URL. */
  brandLogo: string | undefined = undefined

  /** Optional favicon URL. */
  favicon: string | undefined = undefined

  /**
   * Panel ID, derived from the class name.
   * E.g. AdminPanel -> 'admin', CustomerPanel -> 'customer'
   */
  get id(): string {
    return this.constructor.name
      .replace(/Panel$/, '')
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()
  }

  // ── Resources & Pages ───────────────────────────────────────────────────

  /** Return the resource classes registered to this panel. */
  abstract resources(): Array<typeof Resource>

  /** Return widget classes for the dashboard. */
  widgets(): any[] {
    return []
  }

  /** Return custom page classes. */
  pages(): any[] {
    return []
  }

  // ── Middleware ─────────────────────────────────────────────────────────

  /** Additional middleware applied to all panel routes. */
  middleware(): any[] {
    return []
  }

  // ── Access Control ────────────────────────────────────────────────────

  /**
   * Gate check: can this user access this panel?
   * Uses the app's existing auth system.
   */
  canAccess(_user: any): boolean | Promise<boolean> {
    return true
  }

  /**
   * Which auth guard to use for this panel.
   * Defaults to the app's default 'web' guard.
   */
  guard(): string {
    return 'web'
  }

  /**
   * Login page URL. When unauthenticated, redirect here.
   * Defaults to the app's standard login route.
   */
  loginUrl(): string {
    return '/login'
  }

  // ── Navigation ────────────────────────────────────────────────────────

  /** Define explicit navigation groups for the sidebar. */
  navigationGroups(): NavigationGroup[] {
    return []
  }

  // ── Theme ─────────────────────────────────────────────────────────────

  /** Custom color overrides. */
  colors(): Record<string, string> {
    return {}
  }

  /** Whether dark mode is enabled. */
  darkMode(): boolean {
    return true
  }

  /** Whether the sidebar can be collapsed. */
  sidebarCollapsible(): boolean {
    return true
  }

  /** Whether to use top navigation instead of a sidebar. */
  topNavigation(): boolean {
    return false
  }

  /** Whether global search is enabled. */
  globalSearch(): boolean {
    return true
  }

  /** Maximum content width. */
  maxContentWidth(): 'full' | '7xl' | '6xl' | '5xl' | '4xl' | '3xl' | '2xl' | 'xl' | 'lg' {
    return '7xl'
  }

  // ── Boot ──────────────────────────────────────────────────────────────

  /**
   * Called during boot to register routes, resolve resources, etc.
   * Override to perform custom initialization.
   */
  boot(_container: Container): void {}
}
