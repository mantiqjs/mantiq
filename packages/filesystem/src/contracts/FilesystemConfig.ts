export interface DiskConfig {
  driver: string
  root?: string
  url?: string
  visibility?: 'public' | 'private'
  [key: string]: unknown
}

export interface FilesystemConfig {
  default: string
  disks: Record<string, DiskConfig>
}
