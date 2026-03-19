export interface PutOptions {
  visibility?: 'public' | 'private'
  mimeType?: string
}

export interface FilesystemDriver {
  // ── Reads ───────────────────────────────────────────────────────────────────
  exists(path: string): Promise<boolean>
  get(path: string): Promise<string | null>
  getBytes(path: string): Promise<Uint8Array | null>
  stream(path: string): Promise<ReadableStream | null>

  // ── Writes ──────────────────────────────────────────────────────────────────
  put(path: string, contents: string | Uint8Array, options?: PutOptions): Promise<void>
  putStream(path: string, stream: ReadableStream, options?: PutOptions): Promise<void>
  append(path: string, contents: string): Promise<void>
  prepend(path: string, contents: string): Promise<void>

  // ── Operations ──────────────────────────────────────────────────────────────
  delete(path: string | string[]): Promise<boolean>
  copy(from: string, to: string): Promise<void>
  move(from: string, to: string): Promise<void>

  // ── Metadata ────────────────────────────────────────────────────────────────
  size(path: string): Promise<number>
  lastModified(path: string): Promise<number>
  mimeType(path: string): Promise<string | null>
  path(filePath: string): string

  // ── URLs ────────────────────────────────────────────────────────────────────
  url(path: string): string
  temporaryUrl(path: string, expiration: number, options?: Record<string, any>): Promise<string>

  // ── Directories ─────────────────────────────────────────────────────────────
  files(directory?: string): Promise<string[]>
  allFiles(directory?: string): Promise<string[]>
  directories(directory?: string): Promise<string[]>
  allDirectories(directory?: string): Promise<string[]>
  makeDirectory(path: string): Promise<void>
  deleteDirectory(directory: string): Promise<boolean>

  // ── Visibility ──────────────────────────────────────────────────────────────
  setVisibility(path: string, visibility: 'public' | 'private'): Promise<void>
  getVisibility(path: string): Promise<string>
}
