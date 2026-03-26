import { useState } from 'react'
import { Header } from './Header.tsx'
import { DocsSidebar } from './DocsSidebar.tsx'
import { TableOfContents } from './TableOfContents.tsx'
import { SearchDialog } from './SearchDialog.tsx'
import { Menu, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

interface NavSection {
  title: string
  pages: { slug: string; title: string }[]
}

interface SearchEntry {
  slug: string
  title: string
  section: string
  headings: { id: string; text: string }[]
  plainText: string
}

interface DocsLayoutProps {
  navigation: NavSection[]
  currentSlug: string
  content: string
  searchEntries: SearchEntry[]
  navigate: (href: string) => void
  children: React.ReactNode
}

export function DocsLayout({ navigation, currentSlug, content, searchEntries, navigate, children }: DocsLayoutProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <Header onSearchOpen={() => setSearchOpen(true)} variant="docs" />

      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
        <div className="relative flex pt-16">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg lg:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Mobile sidebar overlay */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
                  onClick={() => setMobileMenuOpen(false)}
                />
                <motion.div
                  initial={{ x: -280 }}
                  animate={{ x: 0 }}
                  exit={{ x: -280 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                  className="fixed left-0 top-0 z-30 h-full w-72 bg-background p-6 pt-20 shadow-xl lg:hidden"
                >
                  <DocsSidebar navigation={navigation} currentSlug={currentSlug} />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Desktop sidebar */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <DocsSidebar navigation={navigation} currentSlug={currentSlug} />
          </aside>

          {/* Main content */}
          <main className="min-w-0 flex-1 px-4 py-6 lg:px-10">
            <div className="mx-auto max-w-3xl">
              {children}
            </div>
          </main>

          {/* Right sidebar — Table of Contents */}
          <aside className="hidden w-56 shrink-0 xl:block">
            <TableOfContents content={content} />
          </aside>
        </div>
      </div>

      <SearchDialog
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        entries={searchEntries || []}
        navigate={navigate}
      />
    </div>
  )
}
