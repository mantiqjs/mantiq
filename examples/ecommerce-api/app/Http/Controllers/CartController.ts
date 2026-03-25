import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { CartItem } from '../../Models/CartItem.ts'
import { Product } from '../../Models/Product.ts'

async function getUserId(request: MantiqRequest): Promise<number | null> {
  const manager = auth()
  manager.setRequest(request)
  const user = await manager.user() as any
  return user ? (user.id ?? user.getAttribute?.('id') ?? null) : null
}

export class CartController {
  async index(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const items = await CartItem.query()
      .where('user_id', userId)
      .get() as any[]

    // Fetch product details for each cart item
    const data = await Promise.all(
      items.map(async (item) => {
        const productId = item.getAttribute('product_id') as number
        const product = await Product.find(productId)
        const quantity = item.getAttribute('quantity') as number

        const productData = product ? product.toObject() : null
        const unitPrice = productData ? productData.price : 0
        const lineTotal = unitPrice * quantity

        return {
          ...item.toObject(),
          product: productData ? {
            ...productData,
            price_display: (productData.price / 100).toFixed(2),
          } : null,
          line_total: lineTotal,
          line_total_display: (lineTotal / 100).toFixed(2),
        }
      })
    )

    const cartTotal = data.reduce((sum, item) => sum + item.line_total, 0)

    return MantiqResponse.json({
      data,
      summary: {
        item_count: data.length,
        total: cartTotal,
        total_display: (cartTotal / 100).toFixed(2),
      },
    })
  }

  async add(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const body = await request.input() as { product_id?: number; quantity?: number }

    if (!body.product_id) {
      return MantiqResponse.json({ error: 'Product ID is required.' }, 422)
    }

    const quantity = body.quantity ?? 1
    if (quantity < 1) {
      return MantiqResponse.json({ error: 'Quantity must be at least 1.' }, 422)
    }

    // Check product exists and is active
    const product = await Product.find(body.product_id)
    if (!product) {
      return MantiqResponse.json({ error: 'Product not found.' }, 404)
    }
    if (product.getAttribute('status') !== 'active') {
      return MantiqResponse.json({ error: 'Product is not available.' }, 422)
    }

    // Check stock
    const stock = product.getAttribute('stock_quantity') as number
    if (stock < quantity) {
      return MantiqResponse.json({ error: `Insufficient stock. Only ${stock} available.` }, 422)
    }

    // Check if item already in cart
    const existing = await CartItem.query()
      .where('user_id', userId)
      .where('product_id', body.product_id)
      .first() as any

    if (existing) {
      const currentQty = existing.getAttribute('quantity') as number
      const newQty = currentQty + quantity
      if (newQty > stock) {
        return MantiqResponse.json({ error: `Insufficient stock. Only ${stock} available (${currentQty} already in cart).` }, 422)
      }
      existing.setAttribute('quantity', newQty)
      await existing.save()
      return MantiqResponse.json({ data: existing.toObject(), message: 'Cart item quantity updated.' })
    }

    const cartItem = await CartItem.create({
      user_id: userId,
      product_id: body.product_id,
      quantity,
    })

    return MantiqResponse.json({ data: cartItem.toObject(), message: 'Item added to cart.' }, 201)
  }

  async update(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const id = Number(request.param('id'))
    const cartItem = await CartItem.find(id)

    if (!cartItem || cartItem.getAttribute('user_id') !== userId) {
      return MantiqResponse.json({ error: 'Cart item not found.' }, 404)
    }

    const body = await request.input() as { quantity?: number }

    if (body.quantity === undefined || body.quantity === null) {
      return MantiqResponse.json({ error: 'Quantity is required.' }, 422)
    }
    if (body.quantity < 1) {
      return MantiqResponse.json({ error: 'Quantity must be at least 1.' }, 422)
    }

    // Check stock
    const productId = cartItem.getAttribute('product_id') as number
    const product = await Product.find(productId)
    if (product) {
      const stock = product.getAttribute('stock_quantity') as number
      if (body.quantity > stock) {
        return MantiqResponse.json({ error: `Insufficient stock. Only ${stock} available.` }, 422)
      }
    }

    cartItem.setAttribute('quantity', body.quantity)
    await cartItem.save()

    return MantiqResponse.json({ data: cartItem.toObject(), message: 'Cart item updated.' })
  }

  async remove(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const id = Number(request.param('id'))
    const cartItem = await CartItem.find(id)

    if (!cartItem || cartItem.getAttribute('user_id') !== userId) {
      return MantiqResponse.json({ error: 'Cart item not found.' }, 404)
    }

    await cartItem.delete()

    return MantiqResponse.json({ message: 'Item removed from cart.' })
  }

  async clear(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const items = await CartItem.query().where('user_id', userId).get() as any[]
    for (const item of items) {
      await item.delete()
    }

    return MantiqResponse.json({ message: 'Cart cleared.' })
  }
}
