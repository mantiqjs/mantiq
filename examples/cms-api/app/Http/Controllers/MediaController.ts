import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Media } from '../../Models/Media.ts'

export class MediaController {
  async index(request: MantiqRequest): Promise<Response> {
    const page = Math.max(1, Number(request.query('page') ?? 1))
    const perPage = Math.min(100, Math.max(1, Number(request.query('per_page') ?? 15)))
    const mimeType = request.query('mime_type')
    const folder = request.query('folder')
    const search = request.query('search') ?? ''

    // Count query
    let countQuery = Media.query() as any
    if (mimeType) {
      countQuery = countQuery.where('mime_type', 'LIKE', `${mimeType}%`)
    }
    if (folder) {
      countQuery = countQuery.where('folder', folder)
    }
    if (search) {
      countQuery = countQuery.where('filename', 'LIKE', `%${search}%`)
    }
    const total = await countQuery.count() as number

    // Data query
    let dataQuery = Media.query() as any
    if (mimeType) {
      dataQuery = dataQuery.where('mime_type', 'LIKE', `${mimeType}%`)
    }
    if (folder) {
      dataQuery = dataQuery.where('folder', folder)
    }
    if (search) {
      dataQuery = dataQuery.where('filename', 'LIKE', `%${search}%`)
    }

    const items = await dataQuery
      .orderBy('created_at', 'desc')
      .limit(perPage)
      .offset((page - 1) * perPage)
      .get() as any[]

    return MantiqResponse.json({
      data: items.map((m: any) => m.toObject()),
      meta: {
        total,
        page,
        per_page: perPage,
        last_page: Math.ceil(total / perPage),
      },
    })
  }

  async show(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const media = await Media.find(id)

    if (!media) {
      return MantiqResponse.json({ error: 'Media not found.' }, 404)
    }

    return MantiqResponse.json({ data: media.toObject() })
  }

  async upload(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const body = await request.input() as {
      name?: string
      content?: string
      folder?: string
      alt_text?: string
      caption?: string
    }

    if (!body.name) {
      return MantiqResponse.json({ error: 'File name is required.' }, 422)
    }
    if (!body.content) {
      return MantiqResponse.json({ error: 'File content (base64) is required.' }, 422)
    }

    // Decode base64 content
    const buffer = Buffer.from(body.content, 'base64')
    const folder = body.folder ?? 'uploads'

    // Generate unique filename
    const ext = body.name.includes('.') ? body.name.slice(body.name.lastIndexOf('.')) : ''
    const baseName = body.name.includes('.') ? body.name.slice(0, body.name.lastIndexOf('.')) : body.name
    const timestamp = Date.now()
    const filename = `${baseName}-${timestamp}${ext}`

    // Determine mime type from extension
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf', '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.txt': 'text/plain',
      '.json': 'application/json', '.csv': 'text/csv',
    }
    const mimeType = mimeMap[ext.toLowerCase()] ?? 'application/octet-stream'

    // Store file to filesystem
    const storagePath = `${folder}/${filename}`
    const fullPath = import.meta.dir + `/../../storage/app/${storagePath}`

    // Ensure directory exists
    const dir = fullPath.slice(0, fullPath.lastIndexOf('/'))
    await Bun.write(dir + '/.gitkeep', '')
    await Bun.write(fullPath, buffer)

    const media = await Media.create({
      filename,
      original_name: body.name,
      mime_type: mimeType,
      size: buffer.length,
      path: storagePath,
      alt_text: body.alt_text ?? null,
      caption: body.caption ?? null,
      user_id: user.id,
      folder,
    })

    return MantiqResponse.json({ data: media.toObject() }, 201)
  }

  async update(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const media = await Media.find(id)

    if (!media) {
      return MantiqResponse.json({ error: 'Media not found.' }, 404)
    }

    const body = await request.input() as Record<string, any>

    if (body.alt_text !== undefined) {
      media.setAttribute('alt_text', body.alt_text)
    }
    if (body.caption !== undefined) {
      media.setAttribute('caption', body.caption)
    }
    if (body.folder !== undefined) {
      media.setAttribute('folder', body.folder)
    }

    await media.save()

    return MantiqResponse.json({ data: media.toObject() })
  }

  async destroy(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const media = await Media.find(id)

    if (!media) {
      return MantiqResponse.json({ error: 'Media not found.' }, 404)
    }

    // Delete file from filesystem
    const storagePath = media.getAttribute('path') as string
    const fullPath = import.meta.dir + `/../../storage/app/${storagePath}`
    try {
      const file = Bun.file(fullPath)
      if (await file.exists()) {
        const { unlink } = await import('node:fs/promises')
        await unlink(fullPath)
      }
    } catch {
      // File may already be deleted
    }

    await media.delete()

    return MantiqResponse.json({ message: 'Media deleted.' })
  }

  async folders(_request: MantiqRequest): Promise<Response> {
    const all = await Media.query().get() as any[]

    const folderSet = new Set<string>()
    for (const m of all) {
      folderSet.add(m.getAttribute('folder') as string)
    }

    return MantiqResponse.json({ data: Array.from(folderSet).sort() })
  }
}
