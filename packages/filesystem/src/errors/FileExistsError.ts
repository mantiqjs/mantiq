import { FilesystemError } from './FilesystemError.ts'

export class FileExistsError extends FilesystemError {
  constructor(path: string) {
    super(`File already exists: ${path}`, { path })
  }
}
