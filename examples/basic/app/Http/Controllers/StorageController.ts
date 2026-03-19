import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { storage } from '@mantiq/filesystem'

export class StorageController {
  /** POST /api/storage/write — write a text file */
  async write(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as Record<string, any>
    const path = body.path as string | undefined
    const contents = body.contents as string | undefined

    if (!path || contents === undefined) {
      return MantiqResponse.json({ error: 'path and contents are required' }, 422)
    }

    if (path.includes('..') || path.startsWith('/')) {
      return MantiqResponse.json({ error: 'Invalid path' }, 422)
    }

    const disk = (body.disk as string) ?? 'local'
    await storage(disk).put(path, contents)
    const size = await storage(disk).size(path)

    return MantiqResponse.json({ message: 'File written', path, size })
  }

  /** GET /api/storage/read?path=...&disk=... — read a text file */
  async read(request: MantiqRequest): Promise<Response> {
    const path = request.query('path')
    const disk = request.query('disk') ?? 'local'

    if (!path) {
      return MantiqResponse.json({ error: 'path is required' }, 422)
    }

    const driver = storage(disk)
    const contents = await driver.get(path)

    if (contents === null) {
      return MantiqResponse.json({ error: 'File not found', path }, 404)
    }

    return MantiqResponse.json({ path, contents, size: await driver.size(path) })
  }

  /** GET /api/storage/list?directory=...&disk=... — list files */
  async list(request: MantiqRequest): Promise<Response> {
    const directory = request.query('directory') ?? ''
    const disk = request.query('disk') ?? 'local'

    const driver = storage(disk)
    const [files, directories] = await Promise.all([
      driver.files(directory),
      driver.directories(directory),
    ])

    const fileDetails = await Promise.all(
      files.map(async (f) => ({
        path: f,
        size: await driver.size(f),
        lastModified: await driver.lastModified(f),
      })),
    )

    return MantiqResponse.json({ directory: directory || '/', files: fileDetails, directories })
  }

  /** DELETE /api/storage/delete — delete files */
  async destroy(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as Record<string, any>
    const path = body.path as string | string[] | undefined
    const disk = (body.disk as string) ?? 'local'

    if (!path) {
      return MantiqResponse.json({ error: 'path is required' }, 422)
    }

    const result = await storage(disk).delete(path)
    return MantiqResponse.json({ deleted: result, path })
  }

  /** GET /api/storage/info?path=...&disk=... — get file info */
  async info(request: MantiqRequest): Promise<Response> {
    const path = request.query('path')
    const disk = request.query('disk') ?? 'local'

    if (!path) {
      return MantiqResponse.json({ error: 'path is required' }, 422)
    }

    const driver = storage(disk)
    const exists = await driver.exists(path)

    if (!exists) {
      return MantiqResponse.json({ error: 'File not found', path }, 404)
    }

    const [size, lastModified, mimeType, visibility] = await Promise.all([
      driver.size(path),
      driver.lastModified(path),
      driver.mimeType(path),
      driver.getVisibility(path),
    ])

    return MantiqResponse.json({ path, size, lastModified, mimeType, visibility })
  }

  /** POST /api/storage/upload — upload a file */
  async upload(request: MantiqRequest): Promise<Response> {
    // input() triggers multipart body parsing which populates parsedFiles
    await request.input()
    const file = request.file('file')

    if (!file) {
      return MantiqResponse.json({ error: 'No file uploaded' }, 422)
    }

    const disk = request.query('disk') ?? 'local'
    const directory = request.query('directory') ?? 'uploads'
    const filename = `${Date.now()}_${file.name()}`
    const path = `${directory}/${filename}`

    await storage(disk).put(path, await file.bytes())

    return MantiqResponse.json({
      message: 'File uploaded',
      path,
      name: file.name(),
      size: file.size(),
      mimeType: file.mimeType(),
    })
  }
}
