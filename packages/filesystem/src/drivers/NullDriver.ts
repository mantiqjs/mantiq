import type { FilesystemDriver, PutOptions } from '../contracts/FilesystemDriver.ts'

export class NullDriver implements FilesystemDriver {
  async exists(_path: string): Promise<boolean> { return false }
  async get(_path: string): Promise<string | null> { return null }
  async getBytes(_path: string): Promise<Uint8Array | null> { return null }
  async stream(_path: string): Promise<ReadableStream | null> { return null }

  async put(_path: string, _contents: string | Uint8Array, _options?: PutOptions): Promise<void> {}
  async putStream(_path: string, _stream: ReadableStream, _options?: PutOptions): Promise<void> {}
  async append(_path: string, _contents: string): Promise<void> {}
  async prepend(_path: string, _contents: string): Promise<void> {}

  async delete(_path: string | string[]): Promise<boolean> { return true }
  async copy(_from: string, _to: string): Promise<void> {}
  async move(_from: string, _to: string): Promise<void> {}

  async size(_path: string): Promise<number> { return 0 }
  async lastModified(_path: string): Promise<number> { return 0 }
  async mimeType(_path: string): Promise<string | null> { return null }
  path(filePath: string): string { return filePath }

  url(path: string): string { return path }
  async temporaryUrl(path: string, _expiration: number): Promise<string> { return path }

  async files(_directory?: string): Promise<string[]> { return [] }
  async allFiles(_directory?: string): Promise<string[]> { return [] }
  async directories(_directory?: string): Promise<string[]> { return [] }
  async allDirectories(_directory?: string): Promise<string[]> { return [] }
  async makeDirectory(_path: string): Promise<void> {}
  async deleteDirectory(_directory: string): Promise<boolean> { return true }

  async setVisibility(_path: string, _visibility: 'public' | 'private'): Promise<void> {}
  async getVisibility(_path: string): Promise<string> { return 'public' }
}
