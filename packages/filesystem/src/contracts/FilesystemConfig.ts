export interface DiskConfig {
  driver: string
  root?: string | undefined
  url?: string | undefined
  visibility?: 'public' | 'private' | undefined
  [key: string]: unknown
}

export interface S3DiskConfig extends DiskConfig {
  driver: 's3'
  bucket: string
  region?: string | undefined
  key?: string | undefined
  secret?: string | undefined
  token?: string | undefined
  endpoint?: string | undefined
  forcePathStyle?: boolean | undefined
}

export interface GCSDiskConfig extends DiskConfig {
  driver: 'gcs'
  bucket: string
  projectId?: string | undefined
  keyFilename?: string | undefined
  credentials?: Record<string, any> | undefined
}

export interface AzureDiskConfig extends DiskConfig {
  driver: 'azure'
  container: string
  connectionString?: string | undefined
  accountName?: string | undefined
  accountKey?: string | undefined
  sasToken?: string | undefined
}

export interface FTPDiskConfig extends DiskConfig {
  driver: 'ftp'
  host: string
  port?: number | undefined
  username?: string | undefined
  password?: string | undefined
  secure?: boolean | 'implicit' | undefined
  timeout?: number | undefined
}

export interface SFTPDiskConfig extends DiskConfig {
  driver: 'sftp'
  host: string
  port?: number | undefined
  username?: string | undefined
  password?: string | undefined
  privateKey?: string | undefined
  passphrase?: string | undefined
}

export interface FilesystemConfig {
  default: string
  disks: Record<string, DiskConfig>
}
