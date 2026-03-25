import { Seeder } from '@mantiq/database'
import { HashManager } from '@mantiq/core'
import { User } from '../../app/Models/User.ts'
import { Folder } from '../../app/Models/Folder.ts'
import { File } from '../../app/Models/File.ts'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import crypto from 'node:crypto'

const STORAGE_DIR = import.meta.dir + '/../../storage/app/files'

export default class DatabaseSeeder extends Seeder {
  override async run() {
    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const hashedPassword = await hasher.make('password')

    // ── Users ────────────────────────────────────────────────────────────────
    let admin = await User.where('email', 'admin@vault.com').first() as any
    if (!admin) {
      admin = await User.create({
        name: 'Admin',
        email: 'admin@vault.com',
        password: hashedPassword,
        storage_quota: 1073741824,  // 1 GB
        storage_used: 0,
      })
    }

    let regularUser = await User.where('email', 'user@vault.com').first() as any
    if (!regularUser) {
      regularUser = await User.create({
        name: 'Jane User',
        email: 'user@vault.com',
        password: hashedPassword,
        storage_quota: 104857600,  // 100 MB
        storage_used: 0,
      })
    }

    const adminId = admin.getAttribute('id') as number

    // ── Folders (for admin) ──────────────────────────────────────────────────
    const folderData = [
      { name: 'Documents', path: '/Documents' },
      { name: 'Images', path: '/Images' },
      { name: 'Projects', path: '/Projects' },
    ]

    const folderIds: Record<string, number> = {}
    for (const fd of folderData) {
      const existing = await Folder.query()
        .where('user_id', adminId)
        .where('name', fd.name)
        .whereNull('parent_id')
        .first() as any

      if (!existing) {
        const folder = await Folder.create({
          name: fd.name,
          user_id: adminId,
          parent_id: null,
          path: fd.path,
        }) as any
        folderIds[fd.name] = folder.getAttribute('id') as number
      } else {
        folderIds[fd.name] = existing.getAttribute('id') as number
      }
    }

    // ── Sample files (for admin) ─────────────────────────────────────────────
    // Ensure storage directory exists
    if (!existsSync(STORAGE_DIR)) {
      await mkdir(STORAGE_DIR, { recursive: true })
    }

    const sampleFiles = [
      {
        name: 'readme.txt',
        content: 'Welcome to File Vault!\n\nThis is a secure file storage system built with MantiqJS.\nUpload, organize, and share your files with confidence.',
        folder: 'Documents',
      },
      {
        name: 'notes.txt',
        content: 'Meeting Notes - Q1 Planning\n\n- Review product roadmap\n- Discuss resource allocation\n- Set quarterly OKRs\n- Schedule follow-up meetings',
        folder: 'Documents',
      },
      {
        name: 'todo.txt',
        content: 'TODO List:\n\n[x] Set up file vault\n[x] Create folder structure\n[ ] Upload project assets\n[ ] Share design files with team\n[ ] Review storage quotas',
        folder: 'Projects',
      },
      {
        name: 'config.json',
        content: JSON.stringify({
          app: 'File Vault',
          version: '1.0.0',
          features: ['upload', 'download', 'share', 'encrypt'],
          maxFileSize: '50MB',
        }, null, 2),
        folder: 'Projects',
      },
      {
        name: 'description.txt',
        content: 'Image Library\n\nThis folder is intended for storing image assets.\nSupported formats: PNG, JPG, GIF, SVG, WebP.',
        folder: 'Images',
      },
    ]

    let totalSeedSize = 0

    for (const sf of sampleFiles) {
      const existingFile = await File.query()
        .where('user_id', adminId)
        .where('name', sf.name)
        .first() as any

      if (existingFile) continue

      const buffer = Buffer.from(sf.content, 'utf-8')
      const ext = sf.name.includes('.') ? '.' + sf.name.split('.').pop() : ''
      const storedName = crypto.randomUUID() + ext
      const checksum = new Bun.CryptoHasher('sha256').update(buffer).digest('hex')

      // Detect mime type
      const mimeMap: Record<string, string> = {
        txt: 'text/plain',
        json: 'application/json',
      }
      const mimeType = mimeMap[ext.replace('.', '')] ?? 'application/octet-stream'

      // Write to storage
      await Bun.write(STORAGE_DIR + '/' + storedName, buffer)

      await File.create({
        name: sf.name,
        stored_name: storedName,
        user_id: adminId,
        folder_id: folderIds[sf.folder] ?? null,
        mime_type: mimeType,
        size: buffer.length,
        checksum,
        encrypted: 0,
        description: null,
      })

      totalSeedSize += buffer.length
    }

    // Update admin's storage_used
    if (totalSeedSize > 0) {
      const freshAdmin = await User.find(adminId) as any
      const currentUsed = freshAdmin.getAttribute('storage_used') as number
      freshAdmin.setAttribute('storage_used', currentUsed + totalSeedSize)
      await freshAdmin.save()
    }
  }
}
