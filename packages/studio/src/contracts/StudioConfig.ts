export interface SidebarConfig {
  collapsible: boolean
  width: string
  collapsedWidth: string
}

export interface ColorConfig {
  primary: string
  secondary: string
  accent: string
  danger: string
  warning: string
  success: string
  info: string
}

export interface PanelConfig {
  path: string
  brandName: string
  brandLogo: string | undefined
  favicon: string | undefined
  colors: ColorConfig
  darkMode: boolean
  sidebar: SidebarConfig
  maxContentWidth: 'full' | '7xl' | '6xl' | '5xl' | '4xl' | '3xl' | '2xl' | 'xl' | 'lg'
  globalSearchEnabled: boolean
  globalSearchKeys: string[]
  databaseNotifications: boolean
  spa: boolean
  unsavedChangesAlerts: boolean
  registrationEnabled: boolean
  passwordResetEnabled: boolean
  profileEnabled: boolean
  tenantAware: boolean
  defaultLocale: string
  timezone: string
}

export const defaultPanelConfig: PanelConfig = {
  path: '/admin',
  brandName: 'Mantiq Studio',
  brandLogo: undefined,
  favicon: undefined,
  colors: {
    primary: '#6366f1',
    secondary: '#64748b',
    accent: '#f59e0b',
    danger: '#ef4444',
    warning: '#f59e0b',
    success: '#22c55e',
    info: '#3b82f6',
  },
  darkMode: true,
  sidebar: {
    collapsible: true,
    width: '16rem',
    collapsedWidth: '4.5rem',
  },
  maxContentWidth: '7xl',
  globalSearchEnabled: true,
  globalSearchKeys: [],
  databaseNotifications: false,
  spa: true,
  unsavedChangesAlerts: true,
  registrationEnabled: false,
  passwordResetEnabled: true,
  profileEnabled: true,
  tenantAware: false,
  defaultLocale: 'en',
  timezone: 'UTC',
}
