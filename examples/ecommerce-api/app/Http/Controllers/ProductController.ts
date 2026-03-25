import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { Product } from '../../Models/Product.ts'
import { Category } from '../../Models/Category.ts'

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function formatProduct(product: any): Record<string, any> {
  const obj = product.toObject()
  return {
    ...obj,
    price_display: (obj.price / 100).toFixed(2),
    compare_at_price_display: obj.compare_at_price ? (obj.compare_at_price / 100).toFixed(2) : null,
  }
}

export class ProductController {
  async index(request: MantiqRequest): Promise<Response> {
    const page = Math.max(1, Number(request.query('page') ?? 1))
    const perPage = Math.min(100, Math.max(1, Number(request.query('per_page') ?? 15)))
    const search = request.query('search') ?? ''
    const categoryId = request.query('category_id')
    const status = request.query('status')
    const minPrice = request.query('min_price')
    const maxPrice = request.query('max_price')
    const featured = request.query('featured')
    const sortBy = request.query('sort') ?? 'created_at'
    const sortDir = request.query('dir') === 'asc' ? 'asc' : 'desc'

    // Build query for data
    let query = Product.query() as any

    if (search) {
      query = query.where('name', 'LIKE', `%${search}%`)
    }
    if (categoryId) {
      query = query.where('category_id', Number(categoryId))
    }
    if (status) {
      query = query.where('status', status)
    }
    if (minPrice) {
      query = query.where('price', '>=', Number(minPrice))
    }
    if (maxPrice) {
      query = query.where('price', '<=', Number(maxPrice))
    }
    if (featured !== undefined && featured !== null) {
      query = query.where('featured', Number(featured))
    }

    const total = await query.count() as number

    // Re-build for actual data fetch with sorting and pagination
    let dataQuery = Product.query() as any
    if (search) {
      dataQuery = dataQuery.where('name', 'LIKE', `%${search}%`)
    }
    if (categoryId) {
      dataQuery = dataQuery.where('category_id', Number(categoryId))
    }
    if (status) {
      dataQuery = dataQuery.where('status', status)
    }
    if (minPrice) {
      dataQuery = dataQuery.where('price', '>=', Number(minPrice))
    }
    if (maxPrice) {
      dataQuery = dataQuery.where('price', '<=', Number(maxPrice))
    }
    if (featured !== undefined && featured !== null) {
      dataQuery = dataQuery.where('featured', Number(featured))
    }

    const products = await dataQuery
      .orderBy(sortBy, sortDir)
      .limit(perPage)
      .offset((page - 1) * perPage)
      .get() as any[]

    return MantiqResponse.json({
      data: products.map(formatProduct),
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
    const product = await Product.find(id)

    if (!product) {
      return MantiqResponse.json({ error: 'Product not found.' }, 404)
    }

    // Fetch category if present
    const categoryId = product.getAttribute('category_id') as number | null
    let category = null
    if (categoryId) {
      const cat = await Category.find(categoryId)
      if (cat) {
        category = cat.toObject()
      }
    }

    return MantiqResponse.json({
      data: {
        ...formatProduct(product),
        category,
      },
    })
  }

  async store(request: MantiqRequest): Promise<Response> {
    const body = await request.input() as {
      name?: string
      description?: string
      price?: number
      compare_at_price?: number | null
      sku?: string
      stock_quantity?: number
      category_id?: number | null
      status?: string
      featured?: number
    }

    if (!body.name) {
      return MantiqResponse.json({ error: 'Product name is required.' }, 422)
    }
    if (body.price === undefined || body.price === null) {
      return MantiqResponse.json({ error: 'Product price is required.' }, 422)
    }
    if (!body.sku) {
      return MantiqResponse.json({ error: 'Product SKU is required.' }, 422)
    }

    // Check unique SKU
    const existingSku = await Product.where('sku', body.sku).first()
    if (existingSku) {
      return MantiqResponse.json({ error: 'A product with this SKU already exists.' }, 422)
    }

    const slug = slugify(body.name)

    // Check unique slug
    const existingSlug = await Product.where('slug', slug).first()
    if (existingSlug) {
      return MantiqResponse.json({ error: 'A product with this name already exists.' }, 422)
    }

    // Validate category exists if provided
    if (body.category_id) {
      const category = await Category.find(body.category_id)
      if (!category) {
        return MantiqResponse.json({ error: 'Category not found.' }, 422)
      }
    }

    const validStatuses = ['draft', 'active', 'archived']
    const status = body.status ?? 'draft'
    if (!validStatuses.includes(status)) {
      return MantiqResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, 422)
    }

    const product = await Product.create({
      name: body.name,
      slug,
      description: body.description ?? null,
      price: body.price,
      compare_at_price: body.compare_at_price ?? null,
      sku: body.sku,
      stock_quantity: body.stock_quantity ?? 0,
      category_id: body.category_id ?? null,
      status,
      featured: body.featured ?? 0,
    })

    return MantiqResponse.json({ data: formatProduct(product) }, 201)
  }

  async update(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const product = await Product.find(id)

    if (!product) {
      return MantiqResponse.json({ error: 'Product not found.' }, 404)
    }

    const body = await request.input() as Record<string, any>

    if (body.name !== undefined) {
      product.setAttribute('name', body.name)
      product.setAttribute('slug', slugify(body.name))
    }
    if (body.description !== undefined) {
      product.setAttribute('description', body.description)
    }
    if (body.price !== undefined) {
      product.setAttribute('price', body.price)
    }
    if (body.compare_at_price !== undefined) {
      product.setAttribute('compare_at_price', body.compare_at_price)
    }
    if (body.sku !== undefined) {
      // Check unique SKU if changing
      const existingSku = await Product.where('sku', body.sku).first()
      if (existingSku && (existingSku.getAttribute('id') as number) !== id) {
        return MantiqResponse.json({ error: 'A product with this SKU already exists.' }, 422)
      }
      product.setAttribute('sku', body.sku)
    }
    if (body.stock_quantity !== undefined) {
      product.setAttribute('stock_quantity', body.stock_quantity)
    }
    if (body.category_id !== undefined) {
      if (body.category_id !== null) {
        const category = await Category.find(body.category_id)
        if (!category) {
          return MantiqResponse.json({ error: 'Category not found.' }, 422)
        }
      }
      product.setAttribute('category_id', body.category_id)
    }
    if (body.status !== undefined) {
      const validStatuses = ['draft', 'active', 'archived']
      if (!validStatuses.includes(body.status)) {
        return MantiqResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, 422)
      }
      product.setAttribute('status', body.status)
    }
    if (body.featured !== undefined) {
      product.setAttribute('featured', body.featured)
    }

    await product.save()

    return MantiqResponse.json({ data: formatProduct(product) })
  }

  async destroy(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const product = await Product.find(id)

    if (!product) {
      return MantiqResponse.json({ error: 'Product not found.' }, 404)
    }

    // Soft delete: set status to 'archived'
    product.setAttribute('status', 'archived')
    await product.save()

    return MantiqResponse.json({ message: 'Product archived successfully.' })
  }
}
