import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  createElement,
} from 'react'
import type { ReactNode } from 'react'
import { usePanel } from '@/hooks/usePanel'

// ── Types ────────────────────────────────────────────────────────────────────

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'mantiq-studio-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

/**
 * Convert a hex color to an oklch CSS string.
 * Uses an approximate conversion via sRGB -> linear RGB -> OKLab -> OKLCH.
 */
function hexToOklch(hex: string): string {
  // Parse hex
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) / 255
  const g = parseInt(clean.substring(2, 4), 16) / 255
  const b = parseInt(clean.substring(4, 6), 16) / 255

  // sRGB to linear
  const linearize = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)

  const lr = linearize(r)
  const lg = linearize(g)
  const lb = linearize(b)

  // Linear RGB to OKLab (using the matrix from Bjorn Ottosson)
  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  const l_c = Math.cbrt(l_)
  const m_c = Math.cbrt(m_)
  const s_c = Math.cbrt(s_)

  const L = 0.2104542553 * l_c + 0.7936177850 * m_c - 0.0040720468 * s_c
  const a = 1.9779984951 * l_c - 2.4285922050 * m_c + 0.4505937099 * s_c
  const bOk = 0.0259040371 * l_c + 0.7827717662 * m_c - 0.8086757660 * s_c

  // OKLab to OKLCH
  const C = Math.sqrt(a * a + bOk * bOk)
  let H = (Math.atan2(bOk, a) * 180) / Math.PI
  if (H < 0) H += 360

  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(2)})`
}

/**
 * Generate a lighter/darker variant of an oklch color for foreground use.
 */
function generateForeground(hex: string, isDark: boolean): string {
  // For foregrounds on colored backgrounds, use near-white or near-black
  // depending on the luminance of the color
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) / 255
  const g = parseInt(clean.substring(2, 4), 16) / 255
  const b = parseInt(clean.substring(4, 6), 16) / 255

  // Relative luminance
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b

  if (isDark) {
    // Dark mode: primary color as foreground should contrast with dark bg
    return luminance > 0.5
      ? 'oklch(0.145 0.004 285.82)'
      : 'oklch(0.985 0.002 247.86)'
  }

  // Light mode: foreground on the primary color
  return luminance > 0.5
    ? 'oklch(0.145 0.004 285.82)'
    : 'oklch(0.984 0.003 247.86)'
}

// ── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
})

// ── Provider ─────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { panel } = usePanel()
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    const stored = getStoredTheme()
    return stored === 'system' ? getSystemTheme() : stored
  })

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme])

  // Resolve system theme and listen for OS changes
  useEffect(() => {
    const resolved = theme === 'system' ? getSystemTheme() : theme
    setResolvedTheme(resolved)

    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e: MediaQueryListEvent) => {
        setResolvedTheme(e.matches ? 'dark' : 'light')
      }
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    }
  }, [theme])

  // Apply dark class to <html>
  useEffect(() => {
    const root = document.documentElement
    if (resolvedTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [resolvedTheme])

  // Apply panel colors as CSS custom properties
  useEffect(() => {
    if (!panel?.colors) return

    const root = document.documentElement
    const isDark = resolvedTheme === 'dark'

    const colorMap: Record<string, string> = {
      primary: '--color-primary',
      danger: '--color-destructive',
      warning: '--color-chart-4',
      success: '--color-chart-2',
    }

    for (const [panelKey, cssVar] of Object.entries(colorMap)) {
      const hex = panel.colors[panelKey]
      if (hex) {
        root.style.setProperty(cssVar, hexToOklch(hex))

        // Also set the foreground variant
        const fgVar = `${cssVar}-foreground`
        root.style.setProperty(fgVar, generateForeground(hex, isDark))
      }
    }

    // Primary also maps to ring and sidebar-primary
    if (panel.colors.primary) {
      const primaryOklch = hexToOklch(panel.colors.primary)
      root.style.setProperty('--color-ring', primaryOklch)
      root.style.setProperty('--color-sidebar-primary', primaryOklch)
      root.style.setProperty(
        '--color-sidebar-primary-foreground',
        generateForeground(panel.colors.primary, isDark),
      )
    }

    return () => {
      // Clean up custom properties when panel changes
      for (const cssVar of Object.values(colorMap)) {
        root.style.removeProperty(cssVar)
        root.style.removeProperty(`${cssVar}-foreground`)
      }
      root.style.removeProperty('--color-ring')
      root.style.removeProperty('--color-sidebar-primary')
      root.style.removeProperty('--color-sidebar-primary-foreground')
    }
  }, [panel?.colors, resolvedTheme])

  const value: ThemeContextValue = { theme, resolvedTheme, setTheme, toggleTheme }

  return createElement(ThemeContext.Provider, { value }, children)
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
