import { useState, useEffect, useCallback, useMemo } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export interface RouteMatch {
  path: string
  pattern: string
  params: Record<string, string>
}

interface RouterState {
  pathname: string
  navigate: (to: string) => void
  match: RouteMatch | null
}

// ── Route matching ───────────────────────────────────────────────────────────

/**
 * Simple path-based route matching with `:param` support.
 * e.g. `/resources/:slug` matches `/resources/users` -> { slug: 'users' }
 */
function matchRoute(
  pathname: string,
  pattern: string,
): Record<string, string> | null {
  const pathParts = pathname.split('/').filter(Boolean)
  const patternParts = pattern.split('/').filter(Boolean)

  if (pathParts.length !== patternParts.length) return null

  const params: Record<string, string> = {}

  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]!
    const pathPart = pathParts[i]!

    if (pp.startsWith(':')) {
      params[pp.slice(1)] = pathPart
    } else if (pp !== pathPart) {
      return null
    }
  }

  return params
}

// ── Routes definition ────────────────────────────────────────────────────────

// Order matters: literal segments before params, longer before shorter
const ROUTES = [
  '/resources/:slug/:id/edit',
  '/resources/:slug/create',
  '/resources/:slug/:id',
  '/resources/:slug',
] as const

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useRouter(): RouterState {
  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    const sync = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', sync)
    window.addEventListener('studio:navigate', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('studio:navigate', sync)
    }
  }, [])

  const navigate = useCallback((to: string) => {
    // Prepend the panel base path so URLs include /admin prefix
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="studio-base-path"]',
    )
    const basePath =
      meta?.content || (window as any).__STUDIO_BASE_PATH__ || ''

    const fullPath = to.startsWith(basePath) ? to : basePath + to
    window.history.pushState(null, '', fullPath)
    setPathname(fullPath)
    // Notify all other useRouter instances
    window.dispatchEvent(new Event('studio:navigate'))
  }, [])

  const match = useMemo((): RouteMatch | null => {
    // Strip the panel base path prefix if present.
    // The base path is embedded in meta or __STUDIO_BASE_PATH__.
    let localPath = pathname

    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="studio-base-path"]',
    )
    const basePath =
      meta?.content || (window as any).__STUDIO_BASE_PATH__ || ''

    if (basePath && localPath.startsWith(basePath)) {
      localPath = localPath.slice(basePath.length) || '/'
    }

    // Try each route pattern (most specific first)
    for (const pattern of ROUTES) {
      const params = matchRoute(localPath, pattern)
      if (params) {
        return { path: localPath, pattern, params }
      }
    }

    return null
  }, [pathname])

  return { pathname, navigate, match }
}

// ── Link helper ──────────────────────────────────────────────────────────────

/**
 * Navigate without full page reload. Call from onClick handlers:
 *
 * ```tsx
 * <a href={url} onClick={navigateLink(navigate, url)}>Link</a>
 * ```
 */
export function navigateLink(
  navigate: (to: string) => void,
  to: string,
): (e: React.MouseEvent) => void {
  return (e) => {
    e.preventDefault()
    navigate(to)
  }
}
