import { useState, useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'

declare global {
  interface Window {
    __MANTIQ_DATA__?: Record<string, any>
  }
}

interface MantiqAppProps {
  pages: Record<string, React.ComponentType<any>>
  initialData?: Record<string, any>
}

function initTheme() {
  if (typeof window === 'undefined') return
  const stored = localStorage.getItem('theme')
  const theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

initTheme()

export function MantiqApp({ pages, initialData }: MantiqAppProps) {
  const windowData = typeof window !== 'undefined' ? window.__MANTIQ_DATA__ : {}
  const initial = initialData ?? windowData
  const [page, setPage] = useState<string>(initial?._page ?? 'Home')
  const [data, setData] = useState<Record<string, any>>(initial ?? {})
  const [transitionKey, setTransitionKey] = useState(0)
  const navigatingRef = useRef(false)

  const navigate = useCallback(async (href: string) => {
    if (navigatingRef.current) return
    navigatingRef.current = true
    try {
      const res = await fetch(href, {
        headers: { 'X-Mantiq': 'true', Accept: 'application/json' },
      })
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) {
        window.location.href = href
        return
      }
      const newData = await res.json()
      setPage(newData._page)
      setData(newData)
      setTransitionKey((k) => k + 1)
      history.pushState(null, '', newData._url)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      navigatingRef.current = false
    }
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a')
      const href = anchor?.getAttribute('href')
      if (!href?.startsWith('/') || anchor?.target || e.ctrlKey || e.metaKey || e.shiftKey) return
      e.preventDefault()
      navigate(href)
    }
    const handlePop = () => navigate(location.pathname + location.search)
    document.addEventListener('click', handleClick)
    window.addEventListener('popstate', handlePop)
    return () => {
      document.removeEventListener('click', handleClick)
      window.removeEventListener('popstate', handlePop)
    }
  }, [navigate])

  const Page = pages[page]

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={transitionKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {Page ? <Page {...data} navigate={navigate} /> : null}
      </motion.div>
    </AnimatePresence>
  )
}
