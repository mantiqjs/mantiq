import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { ContentType } from '../../Models/ContentType.ts'
import { Entry } from '../../Models/Entry.ts'

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export class ContentTypeController {
  async index(_request: MantiqRequest): Promise<Response> {
    const types = await ContentType.query().orderBy('name', 'asc').get() as any[]

    const data = []
    for (const ct of types) {
      const id = ct.getAttribute('id') as number
      const entryCount = await Entry.where('content_type_id', id).count() as number
      data.push({ ...ct.toObject(), entry_count: entryCount })
    }

    return MantiqResponse.json({ data })
  }

  async show(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const ct = await ContentType.find(id)

    if (!ct) {
      return MantiqResponse.json({ error: 'Content type not found.' }, 404)
    }

    const entryCount = await Entry.where('content_type_id', id).count() as number

    return MantiqResponse.json({ data: { ...ct.toObject(), entry_count: entryCount } })
  }

  async store(request: MantiqRequest): Promise<Response> {
    // Admin only
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user() as any
    if (!user || user.role !== 'admin') {
      return MantiqResponse.json({ error: 'Only admins can create content types.' }, 403)
    }

    const body = await request.input() as {
      name?: string
      slug?: string
      description?: string
      fields_schema?: string
      icon?: string
    }

    if (!body.name) {
      return MantiqResponse.json({ error: 'Content type name is required.' }, 422)
    }
    if (!body.fields_schema) {
      return MantiqResponse.json({ error: 'Fields schema is required.' }, 422)
    }

    const slug = body.slug ?? slugify(body.name)

    // Check unique name
    const existingName = await ContentType.where('name', body.name).first()
    if (existingName) {
      return MantiqResponse.json({ error: 'A content type with this name already exists.' }, 422)
    }

    // Check unique slug
    const existingSlug = await ContentType.where('slug', slug).first()
    if (existingSlug) {
      return MantiqResponse.json({ error: 'A content type with this slug already exists.' }, 422)
    }

    const ct = await ContentType.create({
      name: body.name,
      slug,
      description: body.description ?? null,
      fields_schema: body.fields_schema,
      icon: body.icon ?? null,
    })

    return MantiqResponse.json({ data: ct.toObject() }, 201)
  }

  async update(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const ct = await ContentType.find(id)

    if (!ct) {
      return MantiqResponse.json({ error: 'Content type not found.' }, 404)
    }

    const body = await request.input() as Record<string, any>

    if (body.name !== undefined) {
      const existingName = await ContentType.where('name', body.name).first()
      if (existingName && (existingName.getAttribute('id') as number) !== id) {
        return MantiqResponse.json({ error: 'A content type with this name already exists.' }, 422)
      }
      ct.setAttribute('name', body.name)
      ct.setAttribute('slug', slugify(body.name))
    }
    if (body.slug !== undefined) {
      const existingSlug = await ContentType.where('slug', body.slug).first()
      if (existingSlug && (existingSlug.getAttribute('id') as number) !== id) {
        return MantiqResponse.json({ error: 'A content type with this slug already exists.' }, 422)
      }
      ct.setAttribute('slug', body.slug)
    }
    if (body.description !== undefined) {
      ct.setAttribute('description', body.description)
    }
    if (body.fields_schema !== undefined) {
      ct.setAttribute('fields_schema', body.fields_schema)
    }
    if (body.icon !== undefined) {
      ct.setAttribute('icon', body.icon)
    }

    await ct.save()

    return MantiqResponse.json({ data: ct.toObject() })
  }

  async destroy(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const ct = await ContentType.find(id)

    if (!ct) {
      return MantiqResponse.json({ error: 'Content type not found.' }, 404)
    }

    // Check if entries exist
    const entryCount = await Entry.where('content_type_id', id).count() as number
    if (entryCount > 0) {
      return MantiqResponse.json({ error: `Cannot delete content type with ${entryCount} existing entries. Remove entries first.` }, 422)
    }

    await ct.delete()

    return MantiqResponse.json({ message: 'Content type deleted.' })
  }
}
