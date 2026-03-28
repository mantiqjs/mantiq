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
  input<T = any>(key: string, defaultValue?: any): Promise<T>
  input<T = Record<string, any>>(): Promise<T>
  only(...keys: string[]): Promise<Record<string, any>>
  except(...keys: string[]): Promise<Record<string, any>>
  has(...keys: string[]): boolean
  filled(...keys: string[]): Promise<boolean>

  // ── Body errors ────────────────────────────────────────────────────────
  hasBodyError(): boolean
  bodyError(): Error | null

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
  setRouteParam(key: string, value: any): void

  // ── Session ──────────────────────────────────────────────────────────────
  session(): SessionStore
  setSession(session: SessionStore): void
  hasSession(): boolean

  // ── Auth ─────────────────────────────────────────────────────────────────
  bearerToken(): string | null
  user<T = any>(): T | null
  isAuthenticated(): boolean
  setUser(user: any): void

  // ── FormData ────────────────────────────────────────────────────────────
  formData(): Promise<FormData>

  // ── Raw ──────────────────────────────────────────────────────────────────
  raw(): Request
}
