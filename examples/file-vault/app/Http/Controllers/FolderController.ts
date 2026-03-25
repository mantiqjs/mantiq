import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Folder } from '../../Models/Folder.ts'
import { File } from '../../Models/File.ts'

export class FolderController {
  /** List folders for the authenticated user, optionally filtered by parent_id */
  async index(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const parentId = request.query('parent_id')

    let query = Folder.query().where('user_id', user.id) as any
    if (parentId !== undefined && parentId !== null && parentId !== '') {
      query = query.where('parent_id', Number(parentId))
    } else {
      query = query.whereNull('parent_id')
    }

    const folders = await query.orderBy('name', 'asc').get() as any[]

    return MantiqResponse.json({
      data: folders.map((f: any) => f.toObject()),
    })
  }

  /** Show a folder with its subfolders and files */
  async show(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const id = Number(request.param('id'))
    const folder = await Folder.find(id) as any
    if (!folder || folder.getAttribute('user_id') !== user.id) {
      return MantiqResponse.json({ error: 'Folder not found.' }, 404)
    }

    const subfolders = await Folder.query()
      .where('user_id', user.id)
      .where('parent_id', id)
      .orderBy('name', 'asc')
      .get() as any[]

    const files = await File.query()
      .where('user_id', user.id)
      .where('folder_id', id)
      .orderBy('name', 'asc')
      .get() as any[]

    return MantiqResponse.json({
      folder: folder.toObject(),
      subfolders: subfolders.map((f: any) => f.toObject()),
      files: files.map((f: any) => f.toObject()),
    })
  }

  /** Create a new folder */
  async store(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const body = await request.input() as {
      name?: string
      parent_id?: number | null
    }

    if (!body.name || !body.name.trim()) {
      return MantiqResponse.json({ error: 'Folder name is required.' }, 422)
    }

    const parentId = body.parent_id ?? null

    // Validate parent folder exists and belongs to user
    let parentPath = ''
    if (parentId !== null) {
      const parent = await Folder.find(parentId) as any
      if (!parent || parent.getAttribute('user_id') !== user.id) {
        return MantiqResponse.json({ error: 'Parent folder not found.' }, 404)
      }
      parentPath = parent.getAttribute('path') as string
    }

    // Check unique name within parent
    let duplicateQuery = Folder.query()
      .where('user_id', user.id)
      .where('name', body.name.trim()) as any

    if (parentId !== null) {
      duplicateQuery = duplicateQuery.where('parent_id', parentId)
    } else {
      duplicateQuery = duplicateQuery.whereNull('parent_id')
    }

    const duplicate = await duplicateQuery.first()
    if (duplicate) {
      return MantiqResponse.json({ error: 'A folder with this name already exists in the same location.' }, 422)
    }

    const folderPath = parentPath
      ? `${parentPath}/${body.name.trim()}`
      : `/${body.name.trim()}`

    const folder = await Folder.create({
      name: body.name.trim(),
      user_id: user.id,
      parent_id: parentId,
      path: folderPath,
    })

    return MantiqResponse.json({ data: folder.toObject() }, 201)
  }

  /** Rename a folder */
  async update(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const id = Number(request.param('id'))
    const folder = await Folder.find(id) as any
    if (!folder || folder.getAttribute('user_id') !== user.id) {
      return MantiqResponse.json({ error: 'Folder not found.' }, 404)
    }

    const body = await request.input() as { name?: string }
    if (!body.name || !body.name.trim()) {
      return MantiqResponse.json({ error: 'Folder name is required.' }, 422)
    }

    // Check unique name within same parent
    const parentId = folder.getAttribute('parent_id')
    let duplicateQuery = Folder.query()
      .where('user_id', user.id)
      .where('name', body.name.trim()) as any

    if (parentId !== null) {
      duplicateQuery = duplicateQuery.where('parent_id', parentId)
    } else {
      duplicateQuery = duplicateQuery.whereNull('parent_id')
    }

    const duplicate = await duplicateQuery.first() as any
    if (duplicate && duplicate.getAttribute('id') !== id) {
      return MantiqResponse.json({ error: 'A folder with this name already exists in the same location.' }, 422)
    }

    // Update path
    const oldPath = folder.getAttribute('path') as string
    const pathParts = oldPath.split('/')
    pathParts[pathParts.length - 1] = body.name.trim()
    const newPath = pathParts.join('/')

    folder.setAttribute('name', body.name.trim())
    folder.setAttribute('path', newPath)
    await folder.save()

    return MantiqResponse.json({ data: folder.toObject() })
  }

  /** Delete a folder and all its contents recursively */
  async destroy(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    const id = Number(request.param('id'))
    const folder = await Folder.find(id) as any
    if (!folder || folder.getAttribute('user_id') !== user.id) {
      return MantiqResponse.json({ error: 'Folder not found.' }, 404)
    }

    // Recursively delete subfolder contents
    await this.deleteFolderContents(id, user.id)

    // Delete the folder itself
    await folder.delete()

    return MantiqResponse.json({ message: 'Folder and all contents deleted.' })
  }

  /** Recursively delete all files and subfolders within a folder */
  private async deleteFolderContents(folderId: number, userId: number): Promise<void> {
    // Delete files in this folder and update user storage
    const files = await File.query()
      .where('folder_id', folderId)
      .where('user_id', userId)
      .get() as any[]

    for (const file of files) {
      const storedName = file.getAttribute('stored_name') as string
      const fileSize = file.getAttribute('size') as number
      const storagePath = import.meta.dir + '/../../../storage/app/files/' + storedName

      // Remove physical file
      try {
        const bunFile = Bun.file(storagePath)
        if (await bunFile.exists()) {
          const { unlink } = await import('node:fs/promises')
          await unlink(storagePath)
        }
      } catch {
        // File may already be missing
      }

      // Update user storage
      const fileUser = await (await import('../../Models/User.ts')).User.find(userId) as any
      if (fileUser) {
        const currentUsed = fileUser.getAttribute('storage_used') as number
        fileUser.setAttribute('storage_used', Math.max(0, currentUsed - fileSize))
        await fileUser.save()
      }

      await file.delete()
    }

    // Recursively delete subfolders
    const subfolders = await Folder.query()
      .where('parent_id', folderId)
      .where('user_id', userId)
      .get() as any[]

    for (const subfolder of subfolders) {
      await this.deleteFolderContents(subfolder.getAttribute('id') as number, userId)
      await subfolder.delete()
    }
  }
}
