import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils.ts'

interface TocHeading {
  id: string
  text: string
  level: number
}

interface TableOfContentsProps {
  content: string
}

export function TableOfContents({ content }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TocHeading[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Extract headings from rendered content
  useEffect(() => {
    // Small delay to ensure DOM is painted
    const timer = setTimeout(() => {
      const container = document.querySelector('.doc-content')
      if (!container) return
      const els = container.querySelectorAll('h2, h3')
      const items: TocHeading[] = []
      els.forEach((el) => {
        const text = el.textContent?.trim() ?? ''
        let id = el.getAttribute('id')
        if (!id) {
          id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          el.setAttribute('id', id)
        }
        items.push({ id, text, level: el.tagName === 'H2' ? 2 : 3 })
      })
      setHeadings(items)
      if (items.length > 0 && items[0]) {
        setActiveId(items[0].id)
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [content])

  // Intersection observer for scroll-spy
  const setupObserver = useCallback(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the first visible heading
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    )

    headings.forEach((h) => {
      const el = document.getElementById(h.id)
      if (el) observerRef.current!.observe(el)
    })
  }, [headings])

  useEffect(() => {
    setupObserver()
    return () => observerRef.current?.disconnect()
  }, [setupObserver])

  if (headings.length === 0) return null

  return (
    <motion.nav
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto pb-10"
    >
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/60">
        On this page
      </h4>
      <ul className="space-y-1 border-l border-border">
        {headings.map((heading) => {
          const isActive = heading.id === activeId
          return (
            <li key={heading.id} className="relative">
              {isActive && (
                <motion.div
                  layoutId="toc-active"
                  className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                />
              )}
              <a
                href={`#${heading.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  const el = document.getElementById(heading.id)
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className={cn(
                  'block py-0.5 text-[11px] leading-snug transition-colors duration-150',
                  heading.level === 3 ? 'pl-6' : 'pl-3',
                  isActive
                    ? 'font-medium text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {heading.text}
              </a>
            </li>
          )
        })}
      </ul>
    </motion.nav>
  )
}
