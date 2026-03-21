import { useState, useCallback, useEffect } from 'react'

interface MantiqAppProps {
  pages: Record<string, React.ComponentType<any>>
  initialData?: Record<string, any>
}

function initTheme() {
  if (typeof window === 'undefined') return
  const theme =
    localStorage.getItem('theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

initTheme()

export function MantiqApp({ pages, initialData }: MantiqAppProps) {
  const windowData = typeof window !== 'undefined' ? (window as any).__MANTIQ_DATA__ : {}
  const initial = initialData ?? windowData
  const [page, setPage] = useState<string>(initial._page ?? 'Home')
  const [data, setData] = useState<Record<string, any>>(initial)
  const [loading, setLoading] = useState(false)

  const navigate = useCallback(async (href: string) => {
    setLoading(true)
    try {
      const res = await fetch(href, {
        headers: { 'X-Mantiq': 'true', Accept: 'application/json' },
      })
      const newData = await res.json()
      setPage(newData._page)
      setData(newData)
      history.pushState(null, '', newData._url)
      window.scrollTo(0, 0)

      // Handle hash scrolling
      requestAnimationFrame(() => {
        if (location.hash) {
          document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth' })
        }
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a')
      const href = anchor?.getAttribute('href')
      if (!href?.startsWith('/') || anchor?.target || e.ctrlKey || e.metaKey) return
      e.preventDefault()
      navigate(href)
    }
    const handlePop = () => navigate(location.pathname)
    document.addEventListener('click', handleClick)
    window.addEventListener('popstate', handlePop)
    return () => {
      document.removeEventListener('click', handleClick)
      window.removeEventListener('popstate', handlePop)
    }
  }, [navigate])

  const Page = pages[page]
  return Page ? <Page {...data} navigate={navigate} loading={loading} /> : null
}
