import { motion } from 'motion/react'
import { cn } from '@/lib/utils.ts'

interface NavSection {
  title: string
  pages: { slug: string; title: string }[]
}

interface DocsSidebarProps {
  navigation: NavSection[]
  currentSlug: string
}

export function DocsSidebar({ navigation, currentSlug }: DocsSidebarProps) {
  return (
    <nav className="sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto pb-10 pr-4">
      <div className="space-y-6">
        {navigation.map((section, sectionIdx) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: sectionIdx * 0.05 }}
          >
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground/60">
              {section.title}
            </h4>
            <ul className="relative space-y-0.5">
              {section.pages.map((page) => {
                const isActive = page.slug === currentSlug
                return (
                  <li key={page.slug} className="relative">
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-md bg-primary/10"
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                      />
                    )}
                    <a
                      href={`/docs/${page.slug}`}
                      className={cn(
                        'relative block rounded-md px-3 py-1.5 text-[13px] transition-colors duration-150',
                        isActive
                          ? 'font-medium text-primary'
                          : 'text-sidebar-foreground hover:text-foreground'
                      )}
                    >
                      {page.title}
                    </a>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        ))}
      </div>
    </nav>
  )
}
