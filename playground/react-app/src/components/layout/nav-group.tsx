import { useState } from 'react'
import { ChevronRight, ExternalLink } from 'lucide-react'
import { Collapsible } from 'radix-ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import type { NavGroup as NavGroupData } from './sidebar-data'

interface NavGroupProps {
  group: NavGroupData
  activePath: string
  navigate: (href: string) => void
}

function isActive(itemUrl: string, activePath: string): boolean {
  if (itemUrl === activePath) return true
  const itemBase = itemUrl.split('?')[0]
  const activeBase = activePath.split('?')[0]
  return itemBase === activeBase
}

function isGroupActive(
  items: NavGroupData['items'][number]['items'],
  activePath: string,
): boolean {
  if (!items) return false
  return items.some((sub) => isActive(sub.url, activePath))
}

export function NavGroup({ group, activePath, navigate }: NavGroupProps) {
  const { state } = useSidebar()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
      <SidebarMenu>
        {group.items.map((item) =>
          item.items && item.items.length > 0 ? (
            state === 'collapsed' ? (
              <CollapsedNavItem
                key={item.title}
                item={item}
                activePath={activePath}
                navigate={navigate}
              />
            ) : (
              <CollapsibleNavItem
                key={item.title}
                item={item}
                activePath={activePath}
                navigate={navigate}
              />
            )
          ) : item.external ? (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton tooltip={item.title} asChild>
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  <item.icon />
                  <span>{item.title}</span>
                  <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={isActive(item.url, activePath)}
                onClick={(e) => {
                  e.preventDefault()
                  navigate(item.url)
                }}
              >
                <item.icon />
                <span>{item.title}</span>
                {item.badge && (
                  <Badge
                    variant="secondary"
                    className="ml-auto text-[10px] px-1.5 py-0"
                  >
                    {item.badge}
                  </Badge>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ),
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function CollapsibleNavItem({
  item,
  activePath,
  navigate,
}: {
  item: NavGroupData['items'][number]
  activePath: string
  navigate: (href: string) => void
}) {
  const childActive = isGroupActive(item.items, activePath)
  const [open, setOpen] = useState(childActive)

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} asChild>
      <SidebarMenuItem>
        <Collapsible.Trigger asChild>
          <SidebarMenuButton tooltip={item.title} isActive={childActive}>
            <item.icon />
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <SidebarMenuSub>
            {item.items!.map((sub) => (
              <SidebarMenuSubItem key={sub.title}>
                <SidebarMenuSubButton
                  isActive={isActive(sub.url, activePath)}
                  onClick={(e) => {
                    e.preventDefault()
                    navigate(sub.url)
                  }}
                >
                  <span>{sub.title}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </Collapsible.Content>
      </SidebarMenuItem>
    </Collapsible.Root>
  )
}

function CollapsedNavItem({
  item,
  activePath,
  navigate,
}: {
  item: NavGroupData['items'][number]
  activePath: string
  navigate: (href: string) => void
}) {
  const childActive = isGroupActive(item.items, activePath)

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={item.title}
            isActive={childActive}
          >
            <item.icon />
            <span>{item.title}</span>
            <ChevronRight className="ml-auto" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" sideOffset={4}>
          <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {item.items!.map((sub) => (
            <DropdownMenuItem
              key={sub.title}
              onClick={() => navigate(sub.url)}
            >
              <span>{sub.title}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
