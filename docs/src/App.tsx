import { useState, useCallback, useEffect } from 'react'

interface MantiqAppProps {
  pages: Record<string, React.ComponentType<any>>
  initialData?: Record<string, any>
}

export function MantiqApp({ pages, initialData }: MantiqAppProps) {
  const windowData = typeof window !== 'undefined' ? (window as any).__MANTIQ_DATA__ : {}
  const initial = initialData ?? windowData
  const [page, setPage] = useState<string>(initial._page ?? 'Home')
  const [data, setData] = useState<Record<string, any>>(initial)

  const navigate = useCallback(async (href: string) => {
    const res = await fetch(href, {
      headers: { 'X-Mantiq': 'true', Accept: 'application/json' },
    })
    const newData = await res.json()
    setPage(newData._page)
    setData(newData)
    history.pushState(null, '', newData._url)

    // Scroll to top on navigation
    window.scrollTo(0, 0)

    // Re-run Prism syntax highlighting after navigation
    requestAnimationFrame(() => {
      if (typeof (window as any).Prism !== 'undefined') {
        ;(window as any).Prism.highlightAll()
      }
    })
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

  // Run Prism on initial mount
  useEffect(() => {
    if (typeof (window as any).Prism !== 'undefined') {
      ;(window as any).Prism.highlightAll()
    }
  }, [])

  const Page = pages[page]
  return Page ? <Page {...data} navigate={navigate} /> : null
}
