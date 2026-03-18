import { MantiqError } from '../errors/MantiqError.ts'

export class UploadedFile {
  constructor(private readonly file: File) {}

  /** Original filename */
  name(): string {
    return this.file.name
  }

  /** File extension (without dot) */
  extension(): string {
    const parts = this.file.name.split('.')
    return parts.length > 1 ? (parts[parts.length - 1] ?? '') : ''
  }

  /** MIME type */
  mimeType(): string {
    return this.file.type
  }

  /** Size in bytes */
  size(): number {
    return this.file.size
  }

  /** File was uploaded without errors */
  isValid(): boolean {
    return this.file.size > 0
  }

  /**
   * Store the file and return the stored path.
   * @param path - Directory path to store in
   * @param options.disk - Storage disk (currently only local filesystem)
   */
  async store(path: string, _options?: { disk?: string }): Promise<string> {
    const filename = `${Date.now()}_${this.file.name}`
    const fullPath = `${path}/${filename}`
    const bytes = await this.file.arrayBuffer()
    await Bun.write(fullPath, bytes)
    return fullPath
  }

  async bytes(): Promise<Uint8Array> {
    return new Uint8Array(await this.file.arrayBuffer())
  }

  async text(): Promise<string> {
    return this.file.text()
  }

  stream(): ReadableStream {
    return this.file.stream()
  }
}
