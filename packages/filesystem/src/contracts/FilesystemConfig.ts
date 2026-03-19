export interface DiskConfig {
  driver: string
  root?: string
  url?: string
  visibility?: 'public' | 'private'
  [key: string]: unknown
}

export interface S3DiskConfig extends DiskConfig {
  driver: 's3'
  bucket: string
  region?: string
  key?: string
  secret?: string
  token?: string
  endpoint?: string
  forcePathStyle?: boolean
}

export interface GCSDiskConfig extends DiskConfig {
  driver: 'gcs'
  bucket: string
  projectId?: string
  keyFilename?: string
  credentials?: Record<string, any>
}

export interface AzureDiskConfig extends DiskConfig {
  driver: 'azure'
  container: string
  connectionString?: string
  accountName?: string
  accountKey?: string
  sasToken?: string
}

export interface FTPDiskConfig extends DiskConfig {
  driver: 'ftp'
  host: string
  port?: number
  username?: string
  password?: string
  secure?: boolean | 'implicit'
  timeout?: number
}

export interface SFTPDiskConfig extends DiskConfig {
  driver: 'sftp'
  host: string
  port?: number
  username?: string
  password?: string
  privateKey?: string
  passphrase?: string
}

export interface FilesystemConfig {
  default: string
  disks: Record<string, DiskConfig>
}
