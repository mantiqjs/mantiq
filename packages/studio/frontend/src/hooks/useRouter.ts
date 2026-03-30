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

const ROUTES = [
  '/resources/:slug',
  '/resources/:slug/create',
  '/resources/:slug/:id/edit',
] as const

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useRouter(): RouterState {
  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((to: string) => {
    window.history.pushState(null, '', to)
    setPathname(to)
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

    // Try each route pattern (more specific first — order matters)
    for (const pattern of [...ROUTES].reverse()) {
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
