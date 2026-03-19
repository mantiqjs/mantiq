import { FilesystemError } from './FilesystemError.ts'

export class FileNotFoundError extends FilesystemError {
  constructor(path: string) {
    super(`File not found: ${path}`, { path })
  }
}
