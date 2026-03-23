import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { NavGroup } from './nav-group'
import { NavUser, type NavUserProps } from './nav-user'
import { sidebarData } from './sidebar-data'
import { Command } from 'lucide-react'

export interface AppSidebarProps {
  user: NavUserProps['user']
  appName: string
  activePath: string
  navigate: (href: string) => void
  onLogout: () => void
}

export function AppSidebar({
  user,
  appName,
  activePath,
  navigate,
  onLogout,
}: AppSidebarProps) {
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              onClick={() => navigate('/dashboard')}
              tooltip={appName}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Command className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{appName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  Admin Panel
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {sidebarData.map((group) => (
          <NavGroup
            key={group.title}
            group={group}
            activePath={activePath}
            navigate={navigate}
          />
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} navigate={navigate} onLogout={onLogout} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
