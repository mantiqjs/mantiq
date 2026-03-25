import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { Category } from '../../Models/Category.ts'
import { Product } from '../../Models/Product.ts'

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export class CategoryController {
  async index(_request: MantiqRequest): Promise<Response> {
    const categories = await Category.query().orderBy('name', 'asc').get() as any[]

    // Get product counts for each category
    const data = await Promise.all(
      categories.map(async (category) => {
        const categoryId = category.getAttribute('id') as number
        const productCount = await (Product.query() as any)
          .where('category_id', categoryId)
          .where('status', 'active')
          .count() as number

        return {
          ...category.toObject(),
          product_count: productCount,
        }
      })
    )

    return MantiqResponse.json({ data })
  }

  async show(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const category = await Category.find(id)

    if (!category) {
      return MantiqResponse.json({ error: 'Category not found.' }, 404)
    }

    // Fetch products in this category
    const products = await Product.query()
      .where('category_id', id)
      .where('status', 'active')
      .orderBy('name', 'asc')
      .get() as any[]

    const productData = products.map((p: any) => {
      const obj = p.toObject()
      return {
        ...obj,
        price_display: (obj.price / 100).toFixed(2),
        compare_at_price_display: obj.compare_at_price ? (obj.compare_at_price / 100).toFixed(2) : null,
      }
    })

    // Fetch subcategories
    const subcategories = await Category.query()
      .where('parent_id', id)
      .orderBy('name', 'asc')
      .get() as any[]

    return MantiqResponse.json({
      data: {
        ...category.toObject(),
        products: productData,
        subcategories: subcategories.map((s: any) => s.toObject()),
      },
    })
  }

  async store(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as {
      name?: string
      description?: string | null
      parent_id?: number | null
    }

    if (!body.name) {
      return MantiqResponse.json({ error: 'Category name is required.' }, 422)
    }

    const slug = slugify(body.name)

    const existingSlug = await Category.where('slug', slug).first()
    if (existingSlug) {
      return MantiqResponse.json({ error: 'A category with this name already exists.' }, 422)
    }

    // Validate parent category exists if provided
    if (body.parent_id) {
      const parent = await Category.find(body.parent_id)
      if (!parent) {
        return MantiqResponse.json({ error: 'Parent category not found.' }, 422)
      }
    }

    const category = await Category.create({
      name: body.name,
      slug,
      description: body.description ?? null,
      parent_id: body.parent_id ?? null,
    })

    return MantiqResponse.json({ data: category.toObject() }, 201)
  }

  async update(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const category = await Category.find(id)

    if (!category) {
      return MantiqResponse.json({ error: 'Category not found.' }, 404)
    }

    const body = await request.input() as Record<string, any>

    if (body.name !== undefined) {
      category.setAttribute('name', body.name)
      category.setAttribute('slug', slugify(body.name))
    }
    if (body.description !== undefined) {
      category.setAttribute('description', body.description)
    }
    if (body.parent_id !== undefined) {
      if (body.parent_id !== null) {
        if (body.parent_id === id) {
          return MantiqResponse.json({ error: 'A category cannot be its own parent.' }, 422)
        }
        const parent = await Category.find(body.parent_id)
        if (!parent) {
          return MantiqResponse.json({ error: 'Parent category not found.' }, 422)
        }
      }
      category.setAttribute('parent_id', body.parent_id)
    }

    await category.save()

    return MantiqResponse.json({ data: category.toObject() })
  }

  async destroy(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const category = await Category.find(id)

    if (!category) {
      return MantiqResponse.json({ error: 'Category not found.' }, 404)
    }

    // Check if category has products
    const productCount = await (Product.query() as any).where('category_id', id).count() as number
    if (productCount > 0) {
      return MantiqResponse.json({ error: `Cannot delete category with ${productCount} product(s). Reassign or remove products first.` }, 422)
    }

    // Check if category has subcategories
    const subCount = await (Category.query() as any).where('parent_id', id).count() as number
    if (subCount > 0) {
      return MantiqResponse.json({ error: `Cannot delete category with ${subCount} subcategory(ies). Reassign or remove subcategories first.` }, 422)
    }

    await category.delete()

    return MantiqResponse.json({ message: 'Category deleted successfully.' })
  }
}
