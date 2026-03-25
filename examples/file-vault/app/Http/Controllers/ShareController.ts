import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse, HashManager } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { File } from '../../Models/File.ts'
import { ShareLink } from '../../Models/ShareLink.ts'
import crypto from 'node:crypto'

const STORAGE_DIR = import.meta.dir + '/../../../storage/app/files'

export class ShareController {
  /** Create a share link for a file */
  async create(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const fileId = Number(request.param('fileId'))
    const file = await File.find(fileId) as any
    if (!file || file.getAttribute('user_id') !== user.id) {
      return MantiqResponse.json({ error: 'File not found.' }, 404)
    }

    const body = await request.input() as {
      expires_at?: string | null
      max_downloads?: number | null
      password?: string | null
    }

    // Generate unique 64-char token
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')

    // Hash password if provided
    let passwordHash: string | null = null
    if (body.password) {
      const hasher = new HashManager({ bcrypt: { rounds: 10 } })
      passwordHash = await hasher.make(body.password)
    }

    const shareLink = await ShareLink.create({
      file_id: fileId,
      token,
      created_by: user.id,
      expires_at: body.expires_at ?? null,
      max_downloads: body.max_downloads ?? null,
      download_count: 0,
      password_hash: passwordHash,
      is_active: 1,
    })

    return MantiqResponse.json({
      data: {
        ...shareLink.toObject(),
        url: `/api/shared/${token}`,
        has_password: !!passwordHash,
      },
    }, 201)
  }

  /** List active share links for a file */
  async index(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const fileId = Number(request.param('fileId'))
    const file = await File.find(fileId) as any
    if (!file || file.getAttribute('user_id') !== user.id) {
      return MantiqResponse.json({ error: 'File not found.' }, 404)
    }

    const links = await ShareLink.query()
      .where('file_id', fileId)
      .where('is_active', 1)
      .orderBy('created_at', 'desc')
      .get() as any[]

    return MantiqResponse.json({
      data: links.map((link: any) => {
        const obj = link.toObject()
        return {
          ...obj,
          url: `/api/shared/${obj.token}`,
          has_password: !!obj.password_hash,
          password_hash: undefined,
        }
      }),
    })
  }

  /** Revoke (deactivate) a share link */
  async revoke(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const id = Number(request.param('id'))
    const link = await ShareLink.find(id) as any
    if (!link || link.getAttribute('created_by') !== user.id) {
      return MantiqResponse.json({ error: 'Share link not found.' }, 404)
    }

    link.setAttribute('is_active', 0)
    await link.save()

    return MantiqResponse.json({ message: 'Share link revoked.' })
  }

  /** Public endpoint — download file via share token */
  async access(request: MantiqRequest): Promise<Response> {
    const token = request.param('token')

    const link = await ShareLink.query()
      .where('token', token)
      .where('is_active', 1)
      .first() as any

    if (!link) {
      return MantiqResponse.json({ error: 'Share link not found or has been revoked.' }, 404)
    }

    // Check expiry
    const expiresAt = link.getAttribute('expires_at') as string | null
    if (expiresAt) {
      const expiryDate = new Date(expiresAt)
      if (expiryDate < new Date()) {
        return MantiqResponse.json({ error: 'Share link has expired.' }, 410)
      }
    }

    // Check max downloads
    const maxDownloads = link.getAttribute('max_downloads') as number | null
    const downloadCount = link.getAttribute('download_count') as number
    if (maxDownloads !== null && downloadCount >= maxDownloads) {
      return MantiqResponse.json({ error: 'Download limit reached.' }, 410)
    }

    // Check password if set
    const passwordHash = link.getAttribute('password_hash') as string | null
    if (passwordHash) {
      const body = await request.input() as { password?: string }
      const passwordParam = request.query('password') ?? body?.password

      if (!passwordParam) {
        return MantiqResponse.json({ error: 'This share link requires a password.', requires_password: true }, 401)
      }

      const hasher = new HashManager({ bcrypt: { rounds: 10 } })
      const valid = await hasher.check(passwordParam as string, passwordHash)
      if (!valid) {
        return MantiqResponse.json({ error: 'Invalid password.' }, 401)
      }
    }

    // Get the file
    const fileId = link.getAttribute('file_id') as number
    const file = await File.find(fileId) as any
    if (!file) {
      return MantiqResponse.json({ error: 'File no longer exists.' }, 404)
    }

    const storedName = file.getAttribute('stored_name') as string
    const filePath = STORAGE_DIR + '/' + storedName
    const bunFile = Bun.file(filePath)

    if (!(await bunFile.exists())) {
      return MantiqResponse.json({ error: 'File data not found on disk.' }, 404)
    }

    // Increment download count
    link.setAttribute('download_count', downloadCount + 1)
    await link.save()

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
}
