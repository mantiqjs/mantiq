import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { File } from '../../Models/File.ts'
import { User } from '../../Models/User.ts'
import { unlink, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import crypto from 'node:crypto'

const STORAGE_DIR = import.meta.dir + '/../../../storage/app/files'

export class FileController {
  /** List files for the authenticated user with optional filtering and sorting */
  async index(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const folderId = request.query('folder_id')
    const search = request.query('search') ?? ''
    const sortBy = request.query('sort') ?? 'created_at'
    const sortDir = request.query('dir') === 'asc' ? 'asc' : 'desc'
    const page = Math.max(1, Number(request.query('page') ?? 1))
    const perPage = Math.min(100, Math.max(1, Number(request.query('per_page') ?? 20)))

    let query = File.query().where('user_id', user.id) as any

    if (folderId !== undefined && folderId !== null && folderId !== '') {
      query = query.where('folder_id', Number(folderId))
    }

    if (search) {
      query = query.where('name', 'LIKE', `%${search}%`)
    }

    const total = await (File.query().where('user_id', user.id) as any).count() as number

    const files = await query
      .orderBy(sortBy, sortDir)
      .limit(perPage)
      .offset((page - 1) * perPage)
      .get() as any[]

    return MantiqResponse.json({
      data: files.map((f: any) => f.toObject()),
      meta: {
        total,
        page,
        per_page: perPage,
        last_page: Math.ceil(total / perPage),
      },
    })
  }

  /** Show file metadata */
  async show(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const id = Number(request.param('id'))
    const file = await File.find(id) as any
    if (!file || file.getAttribute('user_id') !== user.id) {
      return MantiqResponse.json({ error: 'File not found.' }, 404)
    }

    return MantiqResponse.json({ data: file.toObject() })
  }

  /** Upload a file (base64-encoded content in JSON body) */
  async upload(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const body = await request.input() as {
      name?: string
      content?: string
      folder_id?: number | null
      description?: string
    }

    if (!body.name || !body.content) {
      return MantiqResponse.json({ error: 'File name and content (base64) are required.' }, 422)
    }

    // Decode base64 content
    let buffer: Buffer
    try {
      buffer = Buffer.from(body.content, 'base64')
    } catch {
      return MantiqResponse.json({ error: 'Invalid base64 content.' }, 422)
    }

    const fileSize = buffer.length

    // Check quota
    const storageUsed = user.storage_used as number
    const storageQuota = user.storage_quota as number
    if (storageUsed + fileSize > storageQuota) {
      return MantiqResponse.json({
        error: 'Storage quota exceeded.',
        storage_used: storageUsed,
        storage_quota: storageQuota,
        file_size: fileSize,
        remaining: storageQuota - storageUsed,
      }, 413)
    }

    // Generate stored name with original extension
    const ext = body.name.includes('.') ? '.' + body.name.split('.').pop() : ''
    const storedName = crypto.randomUUID() + ext

    // Compute SHA-256 checksum
    const checksum = new Bun.CryptoHasher('sha256').update(buffer).digest('hex')

    // Detect MIME type from extension
    const mimeType = this.detectMimeType(body.name)

    // Ensure storage directory exists
    if (!existsSync(STORAGE_DIR)) {
      await mkdir(STORAGE_DIR, { recursive: true })
    }

    // Write file to storage
    await Bun.write(STORAGE_DIR + '/' + storedName, buffer)

    // Create database record
    const file = await File.create({
      name: body.name,
      stored_name: storedName,
      user_id: user.id,
      folder_id: body.folder_id ?? null,
      mime_type: mimeType,
      size: fileSize,
      checksum,
      encrypted: 0,
      description: body.description ?? null,
    })

    // Update user's storage_used
    const userRecord = await User.find(user.id) as any
    userRecord.setAttribute('storage_used', storageUsed + fileSize)
    await userRecord.save()

    return MantiqResponse.json({ data: file.toObject() }, 201)
  }

  /** Stream file download */
  async download(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const id = Number(request.param('id'))
    const file = await File.find(id) as any
    if (!file || file.getAttribute('user_id') !== user.id) {
      return MantiqResponse.json({ error: 'File not found.' }, 404)
    }

    const storedName = file.getAttribute('stored_name') as string
    const filePath = STORAGE_DIR + '/' + storedName
    const bunFile = Bun.file(filePath)

    if (!(await bunFile.exists())) {
      return MantiqResponse.json({ error: 'File data not found on disk.' }, 404)
    }

    const fileBuffer = await bunFile.arrayBuffer()
    const fileName = file.getAttribute('name') as string
    const mimeType = file.getAttribute('mime_type') as string

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(fileBuffer.byteLength),
      },
    })
  }

  /** Update file metadata (name, description, folder_id for moving) */
  async update(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const id = Number(request.param('id'))
    const file = await File.find(id) as any
    if (!file || file.getAttribute('user_id') !== user.id) {
      return MantiqResponse.json({ error: 'File not found.' }, 404)
    }

    const body = await request.input() as {
      name?: string
      description?: string
      folder_id?: number | null
    }

    if (body.name !== undefined) {
      file.setAttribute('name', body.name)
    }
    if (body.description !== undefined) {
      file.setAttribute('description', body.description)
    }
    if (body.folder_id !== undefined) {
      file.setAttribute('folder_id', body.folder_id)
    }

    await file.save()

    return MantiqResponse.json({ data: file.toObject() })
  }

  /** Delete a file */
  async destroy(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const id = Number(request.param('id'))
    const file = await File.find(id) as any
    if (!file || file.getAttribute('user_id') !== user.id) {
      return MantiqResponse.json({ error: 'File not found.' }, 404)
    }

    const storedName = file.getAttribute('stored_name') as string
    const fileSize = file.getAttribute('size') as number
    const filePath = STORAGE_DIR + '/' + storedName

    // Remove physical file
    try {
      const bunFile = Bun.file(filePath)
      if (await bunFile.exists()) {
        await unlink(filePath)
      }
    } catch {
      // File may already be missing
    }

    // Update user's storage_used
    const userRecord = await User.find(user.id) as any
    const currentUsed = userRecord.getAttribute('storage_used') as number
    userRecord.setAttribute('storage_used', Math.max(0, currentUsed - fileSize))
    await userRecord.save()

    // Delete database record
    await file.delete()

    return MantiqResponse.json({ message: 'File deleted.' })
  }

  /** Duplicate a file */
  async duplicate(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const id = Number(request.param('id'))
    const file = await File.find(id) as any
    if (!file || file.getAttribute('user_id') !== user.id) {
      return MantiqResponse.json({ error: 'File not found.' }, 404)
    }

    const fileSize = file.getAttribute('size') as number

    // Check quota
    const storageUsed = user.storage_used as number
    const storageQuota = user.storage_quota as number
    if (storageUsed + fileSize > storageQuota) {
      return MantiqResponse.json({ error: 'Storage quota exceeded. Cannot duplicate.' }, 413)
    }

    // Read original file
    const originalStoredName = file.getAttribute('stored_name') as string
    const originalPath = STORAGE_DIR + '/' + originalStoredName
    const bunFile = Bun.file(originalPath)

    if (!(await bunFile.exists())) {
      return MantiqResponse.json({ error: 'Original file data not found on disk.' }, 404)
    }

    const buffer = Buffer.from(await bunFile.arrayBuffer())

    // Generate new stored name
    const originalName = file.getAttribute('name') as string
    const ext = originalName.includes('.') ? '.' + originalName.split('.').pop() : ''
    const newStoredName = crypto.randomUUID() + ext

    // Compute checksum (should be same as original)
    const checksum = new Bun.CryptoHasher('sha256').update(buffer).digest('hex')

    // Write copy to storage
    await Bun.write(STORAGE_DIR + '/' + newStoredName, buffer)

    // Create new file record with " (copy)" suffix
    const copyName = originalName.includes('.')
      ? originalName.replace(/(\.[^.]+)$/, ' (copy)$1')
      : originalName + ' (copy)'

    const newFile = await File.create({
      name: copyName,
      stored_name: newStoredName,
      user_id: user.id,
      folder_id: file.getAttribute('folder_id'),
      mime_type: file.getAttribute('mime_type'),
      size: fileSize,
      checksum,
      encrypted: file.getAttribute('encrypted'),
      description: file.getAttribute('description'),
    })

    // Update user's storage_used
    const userRecord = await User.find(user.id) as any
    userRecord.setAttribute('storage_used', storageUsed + fileSize)
    await userRecord.save()

    return MantiqResponse.json({ data: newFile.toObject() }, 201)
  }

  /** Detect MIME type from file extension */
  private detectMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase()
    const mimeMap: Record<string, string> = {
      txt: 'text/plain',
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      xml: 'application/xml',
      pdf: 'application/pdf',
      zip: 'application/zip',
      gz: 'application/gzip',
      tar: 'application/x-tar',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      webp: 'image/webp',
      ico: 'image/x-icon',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      mp4: 'video/mp4',
      webm: 'video/webm',
      csv: 'text/csv',
      md: 'text/markdown',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }
    return mimeMap[ext ?? ''] ?? 'application/octet-stream'
  }
}
