import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { emit } from '@mantiq/events'
import { dispatch } from '@mantiq/queue'
import { Order } from '../../Models/Order.ts'
import { OrderItem } from '../../Models/OrderItem.ts'
import { CartItem } from '../../Models/CartItem.ts'
import { Product } from '../../Models/Product.ts'
import { User } from '../../Models/User.ts'
import { OrderPlaced } from '../../Events/OrderPlaced.ts'
import { OrderCancelled } from '../../Events/OrderCancelled.ts'
import { OrderStatusUpdated } from '../../Events/OrderStatusUpdated.ts'
import { LowStockDetected } from '../../Events/LowStockDetected.ts'
import { SendOrderConfirmationEmail } from '../../Jobs/SendOrderConfirmationEmail.ts'
import { UpdateInventoryStats } from '../../Jobs/UpdateInventoryStats.ts'

const TAX_RATE = 0.085 // 8.5%

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
}

async function getUserId(request: MantiqRequest): Promise<number | null> {
  const manager = auth()
  manager.setRequest(request)
  const user = await manager.user() as any
  return user ? (user.id ?? user.getAttribute?.('id') ?? null) : null
}

function generateOrderNumber(): string {
  return `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

function formatOrder(order: any, items?: any[]): Record<string, any> {
  const obj = order.toObject()
  const result: Record<string, any> = {
    ...obj,
    subtotal_display: (obj.subtotal / 100).toFixed(2),
    tax_display: (obj.tax / 100).toFixed(2),
    total_display: (obj.total / 100).toFixed(2),
    shipping_address: typeof obj.shipping_address === 'string' ? JSON.parse(obj.shipping_address) : obj.shipping_address,
    billing_address: typeof obj.billing_address === 'string' ? JSON.parse(obj.billing_address) : obj.billing_address,
  }

  if (items) {
    result.items = items
  }

  return result
}

export class OrderController {
  async index(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const page = Math.max(1, Number(request.query('page') ?? 1))
    const perPage = Math.min(100, Math.max(1, Number(request.query('per_page') ?? 15)))
    const status = request.query('status')

    let countQuery = Order.query().where('user_id', userId) as any
    if (status) {
      countQuery = countQuery.where('status', status)
    }
    const total = await countQuery.count() as number

    let dataQuery = Order.query().where('user_id', userId) as any
    if (status) {
      dataQuery = dataQuery.where('status', status)
    }

    const orders = await dataQuery
      .orderBy('created_at', 'desc')
      .limit(perPage)
      .offset((page - 1) * perPage)
      .get() as any[]

    return MantiqResponse.json({
      data: orders.map((o: any) => formatOrder(o)),
      meta: {
        total,
        page,
        per_page: perPage,
        last_page: Math.ceil(total / perPage),
      },
    })
  }

  async show(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const id = Number(request.param('id'))
    const order = await Order.find(id)

    if (!order || order.getAttribute('user_id') !== userId) {
      return MantiqResponse.json({ error: 'Order not found.' }, 404)
    }

    // Fetch order items with product details
    const orderItems = await OrderItem.query().where('order_id', id).get() as any[]

    const itemsWithProducts = await Promise.all(
      orderItems.map(async (item) => {
        const productId = item.getAttribute('product_id') as number
        const product = await Product.find(productId)
        const obj = item.toObject()
        return {
          ...obj,
          unit_price_display: (obj.unit_price / 100).toFixed(2),
          total_display: (obj.total / 100).toFixed(2),
          product: product ? product.toObject() : null,
        }
      })
    )

    return MantiqResponse.json({ data: formatOrder(order, itemsWithProducts) })
  }

  async checkout(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const body = await request.input() as {
      shipping_address?: Record<string, any>
      billing_address?: Record<string, any>
      notes?: string
    }

    if (!body.shipping_address) {
      return MantiqResponse.json({ error: 'Shipping address is required.' }, 422)
    }
    if (!body.billing_address) {
      return MantiqResponse.json({ error: 'Billing address is required.' }, 422)
    }

    // Fetch cart items
    const cartItems = await CartItem.query().where('user_id', userId).get() as any[]

    if (cartItems.length === 0) {
      return MantiqResponse.json({ error: 'Cart is empty.' }, 422)
    }

    // Validate stock and calculate totals
    let subtotal = 0
    const lineItems: { cartItem: any; product: any; quantity: number; unitPrice: number; lineTotal: number }[] = []

    for (const cartItem of cartItems) {
      const productId = cartItem.getAttribute('product_id') as number
      const quantity = cartItem.getAttribute('quantity') as number
      const product = await Product.find(productId)

      if (!product) {
        return MantiqResponse.json({ error: `Product #${productId} no longer exists.` }, 422)
      }

      if (product.getAttribute('status') !== 'active') {
        return MantiqResponse.json({ error: `Product "${product.getAttribute('name')}" is no longer available.` }, 422)
      }

      const stock = product.getAttribute('stock_quantity') as number
      if (stock < quantity) {
        return MantiqResponse.json({
          error: `Insufficient stock for "${product.getAttribute('name')}". Requested: ${quantity}, Available: ${stock}.`,
        }, 422)
      }

      const unitPrice = product.getAttribute('price') as number
      const lineTotal = unitPrice * quantity
      subtotal += lineTotal

      lineItems.push({ cartItem, product, quantity, unitPrice, lineTotal })
    }

    const tax = Math.round(subtotal * TAX_RATE)
    const total = subtotal + tax
    const orderNumber = generateOrderNumber()

    // Create order
    const order = await Order.create({
      user_id: userId,
      order_number: orderNumber,
      status: 'pending',
      subtotal,
      tax,
      total,
      shipping_address: JSON.stringify(body.shipping_address),
      billing_address: JSON.stringify(body.billing_address),
      notes: body.notes ?? null,
      paid_at: new Date().toISOString(),
      shipped_at: null,
    })

    const orderId = order.getAttribute('id') as number

    // Create order items and decrement stock
    for (const line of lineItems) {
      await OrderItem.create({
        order_id: orderId,
        product_id: line.product.getAttribute('id') as number,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        total: line.lineTotal,
      })

      // Decrement stock
      const currentStock = line.product.getAttribute('stock_quantity') as number
      const newStock = currentStock - line.quantity
      line.product.setAttribute('stock_quantity', newStock)
      await line.product.save()

      // Check for low stock
      if (newStock <= 5 && newStock > 0) {
        try {
          await emit(new LowStockDetected(line.product, newStock))
        } catch { /* event dispatch failure should not block checkout */ }
      }

      // Dispatch inventory stats job
      try {
        await dispatch(new UpdateInventoryStats(line.product.getAttribute('id') as number))
      } catch { /* queue failure should not block checkout */ }
    }

    // Clear cart
    for (const cartItem of cartItems) {
      await cartItem.delete()
    }

    // Dispatch order confirmation email job
    try {
      await dispatch(new SendOrderConfirmationEmail(orderId, userId))
    } catch { /* queue failure should not block checkout */ }

    // Emit order placed event
    try {
      await emit(new OrderPlaced(order, userId))
    } catch { /* event dispatch failure should not block checkout */ }

    // Fetch created order items for response
    const createdItems = await OrderItem.query().where('order_id', orderId).get() as any[]
    const itemsData = createdItems.map((item: any) => {
      const obj = item.toObject()
      return {
        ...obj,
        unit_price_display: (obj.unit_price / 100).toFixed(2),
        total_display: (obj.total / 100).toFixed(2),
      }
    })

    return MantiqResponse.json({
      message: 'Order placed successfully.',
      data: formatOrder(order, itemsData),
    }, 201)
  }

  async cancel(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const id = Number(request.param('id'))
    const order = await Order.find(id)

    if (!order || order.getAttribute('user_id') !== userId) {
      return MantiqResponse.json({ error: 'Order not found.' }, 404)
    }

    const currentStatus = order.getAttribute('status') as string
    const allowed = VALID_TRANSITIONS[currentStatus] ?? []
    if (!allowed.includes('cancelled')) {
      return MantiqResponse.json({ error: `Cannot cancel order with status "${currentStatus}".` }, 422)
    }

    // Restore stock quantities
    const orderItems = await OrderItem.query().where('order_id', id).get() as any[]
    for (const item of orderItems) {
      const productId = item.getAttribute('product_id') as number
      const quantity = item.getAttribute('quantity') as number
      const product = await Product.find(productId)

      if (product) {
        const currentStock = product.getAttribute('stock_quantity') as number
        product.setAttribute('stock_quantity', currentStock + quantity)
        await product.save()
      }
    }

    order.setAttribute('status', 'cancelled')
    await order.save()

    // Emit order cancelled event
    try {
      await emit(new OrderCancelled(order, userId))
    } catch { /* event dispatch failure should not block cancellation */ }

    return MantiqResponse.json({ message: 'Order cancelled successfully.', data: formatOrder(order) })
  }

  async updateStatus(request: MantiqRequest): Promise<Response> {
    const userId = await getUserId(request)
    if (!userId) {
      return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)
    }

    const id = Number(request.param('id'))
    const order = await Order.find(id)

    if (!order) {
      return MantiqResponse.json({ error: 'Order not found.' }, 404)
    }

    const body = await request.input() as { status?: string }

    if (!body.status) {
      return MantiqResponse.json({ error: 'Status is required.' }, 422)
    }

    const currentStatus = order.getAttribute('status') as string
    const allowed = VALID_TRANSITIONS[currentStatus] ?? []

    if (!allowed.includes(body.status)) {
      return MantiqResponse.json({
        error: `Invalid status transition from "${currentStatus}" to "${body.status}". Allowed: ${allowed.length > 0 ? allowed.join(', ') : 'none'}.`,
      }, 422)
    }

    const previousStatus = currentStatus
    order.setAttribute('status', body.status)

    // Set shipped_at timestamp when shipping
    if (body.status === 'shipped') {
      order.setAttribute('shipped_at', new Date().toISOString())
    }

    await order.save()

    // Emit status updated event
    try {
      await emit(new OrderStatusUpdated(order, previousStatus, body.status))
    } catch { /* event dispatch failure should not block status update */ }

    // Send notification for shipped orders
    if (body.status === 'shipped') {
      const orderUserId = order.getAttribute('user_id') as number
      const user = await User.find(orderUserId)
      if (user) {
        console.log(`[OrderController] Order ${order.getAttribute('order_number')} shipped notification sent to ${user.getAttribute('email')}`)
      }
    }

    return MantiqResponse.json({ message: `Order status updated to "${body.status}".`, data: formatOrder(order) })
  }
}
