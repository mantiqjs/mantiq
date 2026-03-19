import type { UploadedFile } from '../http/UploadedFile.ts'
import type { SessionStore } from '../session/Store.ts'

export interface MantiqRequest {
  // ── HTTP basics ──────────────────────────────────────────────────────────
  method(): string
  path(): string
  url(): string
  fullUrl(): string

  // ── Input ────────────────────────────────────────────────────────────────
  query(key: string, defaultValue?: string): string
  query(): Record<string, string>
  input(key: string, defaultValue?: any): Promise<any>
  input(): Promise<Record<string, any>>
  only(...keys: string[]): Promise<Record<string, any>>
  except(...keys: string[]): Promise<Record<string, any>>
  has(...keys: string[]): boolean
  filled(...keys: string[]): Promise<boolean>

  // ── Headers & metadata ───────────────────────────────────────────────────
  header(key: string, defaultValue?: string): string | undefined
  headers(): Record<string, string>
  cookie(key: string, defaultValue?: string): string | undefined
  setCookies(cookies: Record<string, string>): void
  ip(): string
  userAgent(): string
  accepts(...types: string[]): string | false
  expectsJson(): boolean
  isJson(): boolean

  // ── Files ────────────────────────────────────────────────────────────────
  file(key: string): UploadedFile | null
  files(key: string): UploadedFile[]
  hasFile(key: string): boolean

  // ── Route params ─────────────────────────────────────────────────────────
  param(key: string, defaultValue?: any): any
  params(): Record<string, any>
  setRouteParams(params: Record<string, any>): void

  // ── Session ──────────────────────────────────────────────────────────────
  session(): SessionStore
  setSession(session: SessionStore): void
  hasSession(): boolean

  // ── Auth ─────────────────────────────────────────────────────────────────
  user<T = any>(): T | null
  isAuthenticated(): boolean
  setUser(user: any): void

  // ── Raw ──────────────────────────────────────────────────────────────────
  raw(): Request
}
