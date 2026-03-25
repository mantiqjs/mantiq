import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { Category } from '../../Models/Category.ts'
import { Post } from '../../Models/Post.ts'

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export class CategoryController {
  /**
   * List all categories with post counts.
   */
  async index(_request: MantiqRequest): Promise<Response> {
    const categories = await Category.query()
      .orderBy('name', 'asc')
      .get() as any[]

    const data = await Promise.all(
      categories.map(async (category: any) => {
        const obj = category.toObject()
        const postCount = await Post.where('category_id', category.getAttribute('id'))
          .where('status', 'published')
          .count() as number
        obj.post_count = postCount
        return obj
      }),
    )

    return MantiqResponse.json({ data })
  }

  /**
   * Get a single category by ID with post count.
   */
  async show(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const category = await Category.find(Number(id))

    if (!category) {
      return MantiqResponse.json({ message: 'Category not found.' }, 404)
    }

    const obj = category.toObject()
    const postCount = await Post.where('category_id', Number(id))
      .where('status', 'published')
      .count() as number
    obj.post_count = postCount

    return MantiqResponse.json({ data: obj })
  }

  /**
   * Create a new category (auth required).
   */
  async store(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as {
      name?: string
      description?: string
    }

    // ── Validation ──────────────────────────────────────────────────────────
    const errors: Record<string, string> = {}
    if (!body.name || !body.name.trim()) errors.name = 'Name is required.'

    if (Object.keys(errors).length > 0) {
      return MantiqResponse.json({ message: 'Validation failed.', errors }, 422)
    }

    const slug = slugify(body.name!)
    const existing = await Category.where('slug', slug).first()
    if (existing) {
      return MantiqResponse.json({
        message: 'Validation failed.',
        errors: { name: 'A category with this name already exists.' },
      }, 422)
    }

    const category = await Category.create({
      name: body.name!.trim(),
      slug,
      description: body.description?.trim() || null,
    })

    return MantiqResponse.json({ message: 'Category created.', data: category.toObject() }, 201)
  }

  /**
   * Update a category (auth required).
   */
  async update(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const category = await Category.find(Number(id))
    if (!category) return MantiqResponse.json({ message: 'Category not found.' }, 404)

    const body = await request.input() as {
      name?: string
      description?: string
    }

    if (body.name !== undefined) {
      const trimmedName = body.name.trim()
      if (!trimmedName) {
        return MantiqResponse.json({
          message: 'Validation failed.',
          errors: { name: 'Name cannot be empty.' },
        }, 422)
      }
      const newSlug = slugify(trimmedName)
      const existing = await Category.where('slug', newSlug).first()
      if (existing && (existing.getAttribute('id') as number) !== Number(id)) {
        return MantiqResponse.json({
          message: 'Validation failed.',
          errors: { name: 'A category with this name already exists.' },
        }, 422)
      }
      category.setAttribute('name', trimmedName)
      category.setAttribute('slug', newSlug)
    }
    if (body.description !== undefined) {
      category.setAttribute('description', body.description?.trim() || null)
    }

    await category.save()
    return MantiqResponse.json({ message: 'Category updated.', data: category.toObject() })
  }

  /**
   * Delete a category (auth required).
   */
  async destroy(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const category = await Category.find(Number(id))
    if (!category) return MantiqResponse.json({ message: 'Category not found.' }, 404)

    // Disassociate posts — set category_id to null
    const posts = await Post.where('category_id', Number(id)).get() as any[]
    for (const post of posts) {
      post.setAttribute('category_id', null)
      await post.save()
    }

    await category.delete()
    return MantiqResponse.json({ message: 'Category deleted.' })
  }
}
