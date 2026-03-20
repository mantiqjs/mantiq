import type { MantiqRequest } from '@mantiq/core'
import { json } from '@mantiq/core'
import { storage } from '@mantiq/filesystem'
import { SSEManager } from '@mantiq/realtime'

// Singleton SSE manager — shared across requests
let sseManager: SSEManager | null = null
function getSSE(): SSEManager {
  if (!sseManager) {
    const { DEFAULT_CONFIG } = require('@mantiq/realtime')
    sseManager = new SSEManager(DEFAULT_CONFIG)
  }
  return sseManager
}

export class ChatController {
  /** POST /api/chat/upload — upload a file for sharing in chat */
  async upload(request: MantiqRequest): Promise<Response> {
    const file = request.file('file')
    if (!file) {
      return json({ error: 'No file provided' }, 422)
    }

    // Store in chat-files directory with a unique name
    const ext = file.extension() || 'bin'
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `chat-files/${uniqueName}`

    // Write raw bytes to preserve binary files (images, PDFs, etc.)
    const bytes = await file.bytes()
    await storage().put(path, bytes)

    return json({
      url: `/api/chat/files/${uniqueName}`,
      name: file.name(),
      size: file.size(),
      type: file.mimeType(),
    })
  }

  /** GET /api/chat/files/:filename — serve an uploaded chat file */
  async serve(request: MantiqRequest): Promise<Response> {
    const filename = request.param('filename')
    if (!filename || filename.includes('..')) {
      return json({ error: 'Invalid filename' }, 400)
    }

    const path = `chat-files/${filename}`
    const bytes = await storage().getBytes(path)
    if (!bytes) {
      return json({ error: 'File not found' }, 404)
    }

    // Infer content type from extension
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    const mimeTypes: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
      webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf',
      txt: 'text/plain', json: 'application/json',
    }
    const contentType = mimeTypes[ext] || 'application/octet-stream'

    return new Response(bytes, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }

  // ── SSE Endpoints ──────────────────────────────────────────────────────

  /**
   * GET /api/chat/sse?channels=news,alerts&userId=1
   *
   * Opens an SSE stream. Subscribe to channels via query param.
   * Events broadcast to those channels will be pushed to this stream.
   */
  async stream(request: MantiqRequest): Promise<Response> {
    const sse = getSSE()
    const channelsParam = request.query('channels') || ''
    const userId = request.query('userId')
    const channels = channelsParam.split(',').map((c: string) => c.trim()).filter(Boolean)

    const opts: { userId?: string | number; channels?: string[] } = { channels }
    if (userId) opts.userId = Number(userId)
    return sse.connect(opts)
  }

  /**
   * POST /api/chat/sse/broadcast
   * Body: { channel, event, data }
   *
   * Broadcast an event to all SSE connections on a channel.
   */
  async sseBroadcast(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as Record<string, any>
    const channel = body.channel as string
    const event = body.event as string
    const data = body.data as Record<string, any> ?? {}

    if (!channel || !event) {
      return json({ error: 'channel and event are required' }, 422)
    }

    const sse = getSSE()
    sse.broadcast(channel, event, data)

    return json({
      message: 'Broadcast sent',
      channel,
      event,
      listeners: sse.count(),
    })
  }

  /** GET /api/chat/sse/stats — SSE connection stats */
  async sseStats(_request: MantiqRequest): Promise<Response> {
    const sse = getSSE()
    return json({
      connections: sse.count(),
      channels: sse.getChannels(),
    })
  }
}
