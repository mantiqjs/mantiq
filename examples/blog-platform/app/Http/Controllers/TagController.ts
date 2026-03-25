import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { Tag } from '../../Models/Tag.ts'
import { PostTag } from '../../Models/PostTag.ts'

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export class TagController {
  /**
   * List all tags with post counts.
   */
  async index(_request: MantiqRequest): Promise<Response> {
    const tags = await Tag.query()
      .orderBy('name', 'asc')
      .get() as any[]

    const data = await Promise.all(
      tags.map(async (tag: any) => {
        const obj = tag.toObject()
        const postCount = await PostTag.where('tag_id', tag.getAttribute('id')).count() as number
        obj.post_count = postCount
        return obj
      }),
    )

    return MantiqResponse.json({ data })
  }

  /**
   * Get a single tag by ID with post count.
   */
  async show(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const tag = await Tag.find(Number(id))

    if (!tag) {
      return MantiqResponse.json({ message: 'Tag not found.' }, 404)
    }

    const obj = tag.toObject()
    const postCount = await PostTag.where('tag_id', Number(id)).count() as number
    obj.post_count = postCount

    return MantiqResponse.json({ data: obj })
  }

  /**
   * Create a new tag (auth required).
   */
  async store(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as { name?: string }

    if (!body.name || !body.name.trim()) {
      return MantiqResponse.json({
        message: 'Validation failed.',
        errors: { name: 'Name is required.' },
      }, 422)
    }

    const slug = slugify(body.name)
    const existing = await Tag.where('slug', slug).first()
    if (existing) {
      return MantiqResponse.json({
        message: 'Validation failed.',
        errors: { name: 'A tag with this name already exists.' },
      }, 422)
    }

    const tag = await Tag.create({
      name: body.name.trim(),
      slug,
    })

    return MantiqResponse.json({ message: 'Tag created.', data: tag.toObject() }, 201)
  }

  /**
   * Update a tag (auth required).
   */
  async update(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const tag = await Tag.find(Number(id))
    if (!tag) return MantiqResponse.json({ message: 'Tag not found.' }, 404)

    const body = await request.input() as { name?: string }

    if (body.name !== undefined) {
      const trimmedName = body.name.trim()
      if (!trimmedName) {
        return MantiqResponse.json({
          message: 'Validation failed.',
          errors: { name: 'Name cannot be empty.' },
        }, 422)
      }
      const newSlug = slugify(trimmedName)
      const existing = await Tag.where('slug', newSlug).first()
      if (existing && (existing.getAttribute('id') as number) !== Number(id)) {
        return MantiqResponse.json({
          message: 'Validation failed.',
          errors: { name: 'A tag with this name already exists.' },
        }, 422)
      }
      tag.setAttribute('name', trimmedName)
      tag.setAttribute('slug', newSlug)
    }

    await tag.save()
    return MantiqResponse.json({ message: 'Tag updated.', data: tag.toObject() })
  }

  /**
   * Delete a tag (auth required).
   */
  async destroy(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const tag = await Tag.find(Number(id))
    if (!tag) return MantiqResponse.json({ message: 'Tag not found.' }, 404)

    // Remove post-tag associations
    const postTags = await PostTag.where('tag_id', Number(id)).get() as any[]
    for (const pt of postTags) {
      await pt.delete()
    }

    await tag.delete()
    return MantiqResponse.json({ message: 'Tag deleted.' })
  }
}
