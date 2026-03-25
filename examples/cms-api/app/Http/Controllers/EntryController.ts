import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Entry } from '../../Models/Entry.ts'
import { ContentType } from '../../Models/ContentType.ts'
import { Revision } from '../../Models/Revision.ts'

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function buildFilteredQuery(request: MantiqRequest): any {
  let query = Entry.query() as any

  const contentTypeId = request.query('content_type_id')
  const status = request.query('status')
  const authorId = request.query('author_id')
  const locale = request.query('locale')
  const search = request.query('search') ?? ''

  if (contentTypeId) {
    query = query.where('content_type_id', Number(contentTypeId))
  }
  if (status) {
    query = query.where('status', status)
  }
  if (authorId) {
    query = query.where('author_id', Number(authorId))
  }
  if (locale) {
    query = query.where('locale', locale)
  }
  if (search) {
    query = query.where('title', 'LIKE', `%${search}%`)
  }

  return query
}

export class EntryController {
  async index(request: MantiqRequest): Promise<Response> {
    const page = Math.max(1, Number(request.query('page') ?? 1))
    const perPage = Math.min(100, Math.max(1, Number(request.query('per_page') ?? 15)))
    const sortBy = request.query('sort') ?? 'created_at'
    const sortDir = request.query('dir') === 'asc' ? 'asc' : 'desc'

    const countQuery = buildFilteredQuery(request)
    const total = await countQuery.count() as number

    const dataQuery = buildFilteredQuery(request)
    const entries = await dataQuery
      .orderBy(sortBy, sortDir)
      .limit(perPage)
      .offset((page - 1) * perPage)
      .get() as any[]

    return MantiqResponse.json({
      data: entries.map((e: any) => e.toObject()),
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
    const entry = await Entry.find(id)

    if (!entry) {
      return MantiqResponse.json({ error: 'Entry not found.' }, 404)
    }

    return MantiqResponse.json({ data: entry.toObject() })
  }

  async bySlug(request: MantiqRequest): Promise<Response> {
    const slug = request.param('slug')
    const entry = await Entry.where('slug', slug).first()

    if (!entry) {
      return MantiqResponse.json({ error: 'Entry not found.' }, 404)
    }

    return MantiqResponse.json({ data: entry.toObject() })
  }

  async store(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const body = await request.input() as {
      content_type_id?: number
      title?: string
      slug?: string
      data?: string
      status?: string
      locale?: string
    }

    if (!body.content_type_id) {
      return MantiqResponse.json({ error: 'Content type ID is required.' }, 422)
    }
    if (!body.title) {
      return MantiqResponse.json({ error: 'Title is required.' }, 422)
    }
    if (!body.data) {
      return MantiqResponse.json({ error: 'Data is required.' }, 422)
    }

    // Validate content type exists
    const contentType = await ContentType.find(body.content_type_id)
    if (!contentType) {
      return MantiqResponse.json({ error: 'Content type not found.' }, 422)
    }

    // Validate data against content type schema (check required fields)
    const schemaStr = contentType.getAttribute('fields_schema') as string
    try {
      const schema = JSON.parse(schemaStr)
      const data = JSON.parse(body.data)
      if (Array.isArray(schema)) {
        for (const field of schema) {
          if (field.required && (data[field.name] === undefined || data[field.name] === null || data[field.name] === '')) {
            return MantiqResponse.json({ error: `Field '${field.name}' is required for this content type.` }, 422)
          }
        }
      }
    } catch {
      // If schema or data can't be parsed, skip validation
    }

    const validStatuses = ['draft', 'published', 'archived']
    const status = body.status ?? 'draft'
    if (!validStatuses.includes(status)) {
      return MantiqResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, 422)
    }

    const slug = body.slug ?? slugify(body.title)

    const entry = await Entry.create({
      content_type_id: body.content_type_id,
      title: body.title,
      slug,
      data: body.data,
      status,
      author_id: user.id,
      published_at: status === 'published' ? new Date().toISOString() : null,
      version: 1,
      locale: body.locale ?? 'en',
    })

    return MantiqResponse.json({ data: entry.toObject() }, 201)
  }

  async update(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const entry = await Entry.find(id)

    if (!entry) {
      return MantiqResponse.json({ error: 'Entry not found.' }, 404)
    }

    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    // Create revision before updating
    const currentVersion = entry.getAttribute('version') as number
    await Revision.create({
      entry_id: id,
      version: currentVersion,
      data: entry.getAttribute('data') as string,
      title: entry.getAttribute('title') as string,
      status: entry.getAttribute('status') as string,
      changed_by: user.id,
      change_summary: 'Auto-saved before update',
    })

    const body = await request.input() as Record<string, any>

    if (body.title !== undefined) {
      entry.setAttribute('title', body.title)
      if (body.slug === undefined) {
        entry.setAttribute('slug', slugify(body.title))
      }
    }
    if (body.slug !== undefined) {
      entry.setAttribute('slug', body.slug)
    }
    if (body.data !== undefined) {
      entry.setAttribute('data', body.data)
    }
    if (body.status !== undefined) {
      const validStatuses = ['draft', 'published', 'archived']
      if (!validStatuses.includes(body.status)) {
        return MantiqResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, 422)
      }
      entry.setAttribute('status', body.status)
    }
    if (body.locale !== undefined) {
      entry.setAttribute('locale', body.locale)
    }

    // Increment version
    entry.setAttribute('version', currentVersion + 1)

    await entry.save()

    return MantiqResponse.json({ data: entry.toObject() })
  }

  async destroy(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const entry = await Entry.find(id)

    if (!entry) {
      return MantiqResponse.json({ error: 'Entry not found.' }, 404)
    }

    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    // Only admin or the entry's author can delete
    const authorId = entry.getAttribute('author_id') as number
    if (user.role !== 'admin' && user.id !== authorId) {
      return MantiqResponse.json({ error: 'Only admins or the entry author can delete entries.' }, 403)
    }

    await entry.delete()

    return MantiqResponse.json({ message: 'Entry deleted.' })
  }

  async publish(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const entry = await Entry.find(id)

    if (!entry) {
      return MantiqResponse.json({ error: 'Entry not found.' }, 404)
    }

    entry.setAttribute('status', 'published')
    entry.setAttribute('published_at', new Date().toISOString())
    await entry.save()

    return MantiqResponse.json({ data: entry.toObject() })
  }

  async unpublish(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const entry = await Entry.find(id)

    if (!entry) {
      return MantiqResponse.json({ error: 'Entry not found.' }, 404)
    }

    entry.setAttribute('status', 'draft')
    entry.setAttribute('published_at', null)
    await entry.save()

    return MantiqResponse.json({ data: entry.toObject() })
  }

  async revisions(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const entry = await Entry.find(id)

    if (!entry) {
      return MantiqResponse.json({ error: 'Entry not found.' }, 404)
    }

    const revs = await Revision.where('entry_id', id)
      .orderBy('version', 'desc')
      .get() as any[]

    return MantiqResponse.json({
      data: revs.map((r: any) => r.toObject()),
    })
  }

  async restore(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const entry = await Entry.find(id)

    if (!entry) {
      return MantiqResponse.json({ error: 'Entry not found.' }, 404)
    }

    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any

    if (!user) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const body = await request.input() as { version?: number }

    if (!body.version) {
      return MantiqResponse.json({ error: 'Version number is required.' }, 422)
    }

    const revision = await Revision.where('entry_id', id)
      .where('version', body.version)
      .first() as any

    if (!revision) {
      return MantiqResponse.json({ error: `Revision version ${body.version} not found.` }, 404)
    }

    // Save current state as a revision before restoring
    const currentVersion = entry.getAttribute('version') as number
    await Revision.create({
      entry_id: id,
      version: currentVersion,
      data: entry.getAttribute('data') as string,
      title: entry.getAttribute('title') as string,
      status: entry.getAttribute('status') as string,
      changed_by: user.id,
      change_summary: `Auto-saved before restoring to version ${body.version}`,
    })

    // Restore from revision
    entry.setAttribute('title', revision.getAttribute('title'))
    entry.setAttribute('data', revision.getAttribute('data'))
    entry.setAttribute('status', revision.getAttribute('status'))
    entry.setAttribute('version', currentVersion + 1)
    await entry.save()

    return MantiqResponse.json({ data: entry.toObject() })
  }
}
