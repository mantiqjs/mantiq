import { useState, useEffect, type ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { DocsSidebar } from '@/components/layout/docs-sidebar'
import { DocsHeader } from '@/components/layout/docs-header'
import { SearchDialog } from '@/components/search-dialog'

interface NavPage {
  slug: string
  title: string
}

interface NavSection {
  title: string
  pages: NavPage[]
}

interface DocsLayoutProps {
  navigation: NavSection[]
  slug: string
  title: string
  navigate: (href: string) => void
  searchEntries?: any[]
  children: ReactNode
}

export function DocsLayout({ navigation, slug, title, navigate, searchEntries, children }: DocsLayoutProps) {
  const [searchOpen, setSearchOpen] = useState(false)

  // Find current section
  const currentSection = navigation.find((s) =>
    s.pages.some((p) => p.slug === slug),
  )

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={true}>
        <DocsSidebar
          navigation={navigation}
          activeSlug={slug}
          navigate={navigate}
        />
        <SidebarInset>
          <DocsHeader
            sectionTitle={currentSection?.title}
            pageTitle={title}
            onSearchOpen={() => setSearchOpen(true)}
          />
          <main className="flex-1">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        navigation={navigation}
        searchEntries={searchEntries}
        navigate={navigate}
      />
    </TooltipProvider>
  )
}
