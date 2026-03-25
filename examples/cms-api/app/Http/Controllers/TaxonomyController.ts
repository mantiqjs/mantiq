import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { Taxonomy } from '../../Models/Taxonomy.ts'
import { EntryTaxonomy } from '../../Models/EntryTaxonomy.ts'
import { Entry } from '../../Models/Entry.ts'

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export class TaxonomyController {
  async index(request: MantiqRequest): Promise<Response> {
    const type = request.query('type')

    let query = Taxonomy.query() as any
    if (type) {
      query = query.where('type', type)
    }

    const taxonomies = await query.orderBy('name', 'asc').get() as any[]

    return MantiqResponse.json({
      data: taxonomies.map((t: any) => t.toObject()),
    })
  }

  async show(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const taxonomy = await Taxonomy.find(id)

    if (!taxonomy) {
      return MantiqResponse.json({ error: 'Taxonomy not found.' }, 404)
    }

    const entryCount = await EntryTaxonomy.where('taxonomy_id', id).count() as number

    return MantiqResponse.json({
      data: { ...taxonomy.toObject(), entry_count: entryCount },
    })
  }

  async store(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as {
      name?: string
      slug?: string
      type?: string
      description?: string
      parent_id?: number | null
    }

    if (!body.name) {
      return MantiqResponse.json({ error: 'Taxonomy name is required.' }, 422)
    }
    if (!body.type) {
      return MantiqResponse.json({ error: 'Taxonomy type is required.' }, 422)
    }

    const slug = body.slug ?? slugify(body.name)

    // Check unique slug
    const existing = await Taxonomy.where('slug', slug).first()
    if (existing) {
      return MantiqResponse.json({ error: 'A taxonomy with this slug already exists.' }, 422)
    }

    // Validate parent exists if provided
    if (body.parent_id) {
      const parent = await Taxonomy.find(body.parent_id)
      if (!parent) {
        return MantiqResponse.json({ error: 'Parent taxonomy not found.' }, 422)
      }
    }

    const taxonomy = await Taxonomy.create({
      name: body.name,
      slug,
      type: body.type,
      description: body.description ?? null,
      parent_id: body.parent_id ?? null,
    })

    return MantiqResponse.json({ data: taxonomy.toObject() }, 201)
  }

  async update(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const taxonomy = await Taxonomy.find(id)

    if (!taxonomy) {
      return MantiqResponse.json({ error: 'Taxonomy not found.' }, 404)
    }

    const body = await request.input() as Record<string, any>

    if (body.name !== undefined) {
      taxonomy.setAttribute('name', body.name)
      if (body.slug === undefined) {
        taxonomy.setAttribute('slug', slugify(body.name))
      }
    }
    if (body.slug !== undefined) {
      const existing = await Taxonomy.where('slug', body.slug).first()
      if (existing && (existing.getAttribute('id') as number) !== id) {
        return MantiqResponse.json({ error: 'A taxonomy with this slug already exists.' }, 422)
      }
      taxonomy.setAttribute('slug', body.slug)
    }
    if (body.type !== undefined) {
      taxonomy.setAttribute('type', body.type)
    }
    if (body.description !== undefined) {
      taxonomy.setAttribute('description', body.description)
    }
    if (body.parent_id !== undefined) {
      if (body.parent_id !== null) {
        if (body.parent_id === id) {
          return MantiqResponse.json({ error: 'A taxonomy cannot be its own parent.' }, 422)
        }
        const parent = await Taxonomy.find(body.parent_id)
        if (!parent) {
          return MantiqResponse.json({ error: 'Parent taxonomy not found.' }, 422)
        }
      }
      taxonomy.setAttribute('parent_id', body.parent_id)
    }

    await taxonomy.save()

    return MantiqResponse.json({ data: taxonomy.toObject() })
  }

  async destroy(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const taxonomy = await Taxonomy.find(id)

    if (!taxonomy) {
      return MantiqResponse.json({ error: 'Taxonomy not found.' }, 404)
    }

    // Remove entry-taxonomy relationships
    const pivots = await EntryTaxonomy.where('taxonomy_id', id).get() as any[]
    for (const pivot of pivots) {
      await pivot.delete()
    }

    await taxonomy.delete()

    return MantiqResponse.json({ message: 'Taxonomy deleted.' })
  }

  async attach(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as {
      entry_id?: number
      taxonomy_id?: number
    }

    if (!body.entry_id || !body.taxonomy_id) {
      return MantiqResponse.json({ error: 'Both entry_id and taxonomy_id are required.' }, 422)
    }

    // Validate entry exists
    const entry = await Entry.find(body.entry_id)
    if (!entry) {
      return MantiqResponse.json({ error: 'Entry not found.' }, 404)
    }

    // Validate taxonomy exists
    const taxonomy = await Taxonomy.find(body.taxonomy_id)
    if (!taxonomy) {
      return MantiqResponse.json({ error: 'Taxonomy not found.' }, 404)
    }

    // Check if already attached
    const existing = await EntryTaxonomy.where('entry_id', body.entry_id)
      .where('taxonomy_id', body.taxonomy_id)
      .first()
    if (existing) {
      return MantiqResponse.json({ error: 'Taxonomy is already attached to this entry.' }, 422)
    }

    const pivot = await EntryTaxonomy.create({
      entry_id: body.entry_id,
      taxonomy_id: body.taxonomy_id,
    })

    return MantiqResponse.json({ data: pivot.toObject() }, 201)
  }

  async detach(request: MantiqRequest): Promise<Response> {
    const entryId = Number(request.query('entry_id') ?? request.param('entry_id'))
    const taxonomyId = Number(request.query('taxonomy_id') ?? request.param('taxonomy_id'))

    if (!entryId || !taxonomyId) {
      return MantiqResponse.json({ error: 'Both entry_id and taxonomy_id are required.' }, 422)
    }

    const pivot = await EntryTaxonomy.where('entry_id', entryId)
      .where('taxonomy_id', taxonomyId)
      .first()

    if (!pivot) {
      return MantiqResponse.json({ error: 'Relationship not found.' }, 404)
    }

    await pivot.delete()

    return MantiqResponse.json({ message: 'Taxonomy detached from entry.' })
  }

  async entries(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const taxonomy = await Taxonomy.find(id)

    if (!taxonomy) {
      return MantiqResponse.json({ error: 'Taxonomy not found.' }, 404)
    }

    const pivots = await EntryTaxonomy.where('taxonomy_id', id).get() as any[]
    const entries: any[] = []

    for (const pivot of pivots) {
      const entryId = pivot.getAttribute('entry_id') as number
      const entry = await Entry.find(entryId)
      if (entry) {
        entries.push(entry.toObject())
      }
    }

    return MantiqResponse.json({ data: entries })
  }
}
