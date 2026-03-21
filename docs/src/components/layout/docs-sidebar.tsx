import { Command, Github, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

interface NavPage {
  slug: string
  title: string
}

interface NavSection {
  title: string
  pages: NavPage[]
}

interface DocsSidebarProps {
  navigation: NavSection[]
  activeSlug: string
  navigate: (href: string) => void
}

export function DocsSidebar({ navigation, activeSlug, navigate }: DocsSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <a
          href="/"
          className="flex items-center gap-2.5 text-foreground no-underline hover:opacity-80 transition-opacity"
          onClick={(e) => {
            e.preventDefault()
            navigate('/')
          }}
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Command className="size-4" />
          </div>
          <span className="text-lg font-semibold tracking-tight">mantiq</span>
          <Badge variant="secondary" className="ml-1 text-[0.625rem] px-1.5 py-0">
            docs
          </Badge>
        </a>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {navigation.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarMenu>
              {section.pages.map((page) => (
                <SidebarMenuItem key={page.slug}>
                  <SidebarMenuButton
                    isActive={page.slug === activeSlug}
                    onClick={() => navigate(`/docs/${page.slug}`)}
                    className="cursor-pointer"
                  >
                    <span>{page.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="px-4 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[0.625rem]">v0.1.0</Badge>
          <a
            href="https://github.com/mantiqjs/mantiq"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors no-underline"
          >
            <Github className="h-3.5 w-3.5" />
            <span>GitHub</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
