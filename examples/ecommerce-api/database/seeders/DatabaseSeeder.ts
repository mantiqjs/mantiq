import { Seeder } from '@mantiq/database'
import { HashManager } from '@mantiq/core'
import { User } from '../../app/Models/User.ts'
import { Category } from '../../app/Models/Category.ts'
import { Product } from '../../app/Models/Product.ts'
import { Order } from '../../app/Models/Order.ts'
import { OrderItem } from '../../app/Models/OrderItem.ts'

export default class DatabaseSeeder extends Seeder {
  override async run() {
    const existing = await User.where('email', 'admin@example.com').first()
    if (existing) return

    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const hashed = await hasher.make('password')

    // Users
    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', password: hashed })
    const customer = await User.create({ name: 'Jane Customer', email: 'customer@example.com', password: hashed })

    // Categories
    const categories = [
      { name: 'Electronics', slug: 'electronics', description: 'Gadgets, devices, and accessories' },
      { name: 'Clothing', slug: 'clothing', description: 'Apparel and fashion' },
      { name: 'Books', slug: 'books', description: 'Physical and digital books' },
      { name: 'Home & Garden', slug: 'home-garden', description: 'Furniture, decor, and gardening' },
      { name: 'Sports', slug: 'sports', description: 'Sports equipment and activewear' },
    ]
    const catRecords: any[] = []
    for (const c of categories) {
      catRecords.push(await Category.create({ ...c, parent_id: null }))
    }

    // Products
    const products = [
      { name: 'Wireless Noise-Cancelling Headphones', slug: 'wireless-nc-headphones', price: 29999, sku: 'ELEC-001', stock: 50, cat: 0, featured: 1, status: 'active' },
      { name: 'USB-C Fast Charger 65W', slug: 'usb-c-fast-charger', price: 3499, sku: 'ELEC-002', stock: 200, cat: 0, featured: 0, status: 'active' },
      { name: 'Mechanical Keyboard RGB', slug: 'mechanical-keyboard-rgb', price: 12999, sku: 'ELEC-003', stock: 75, cat: 0, featured: 1, status: 'active' },
      { name: '4K Ultra HD Monitor 27"', slug: '4k-uhd-monitor-27', price: 44999, sku: 'ELEC-004', stock: 30, cat: 0, featured: 1, status: 'active' },
      { name: 'Slim Fit Denim Jeans', slug: 'slim-fit-denim-jeans', price: 5999, sku: 'CLTH-001', stock: 150, cat: 1, featured: 0, status: 'active' },
      { name: 'Merino Wool Sweater', slug: 'merino-wool-sweater', price: 8999, sku: 'CLTH-002', stock: 80, cat: 1, featured: 1, status: 'active' },
      { name: 'Running Sneakers Pro', slug: 'running-sneakers-pro', price: 13999, sku: 'CLTH-003', stock: 60, cat: 1, featured: 0, status: 'active' },
      { name: 'Waterproof Jacket', slug: 'waterproof-jacket', price: 17999, sku: 'CLTH-004', stock: 40, cat: 1, featured: 0, status: 'active' },
      { name: 'Clean Code: A Handbook', slug: 'clean-code-handbook', price: 3299, sku: 'BOOK-001', stock: 500, cat: 2, featured: 1, status: 'active' },
      { name: 'The Pragmatic Programmer', slug: 'pragmatic-programmer', price: 4199, sku: 'BOOK-002', stock: 300, cat: 2, featured: 0, status: 'active' },
      { name: 'Design Patterns in TypeScript', slug: 'design-patterns-ts', price: 3799, sku: 'BOOK-003', stock: 250, cat: 2, featured: 0, status: 'active' },
      { name: 'System Design Interview', slug: 'system-design-interview', price: 2999, sku: 'BOOK-004', stock: 400, cat: 2, featured: 0, status: 'active' },
      { name: 'Ergonomic Standing Desk', slug: 'ergonomic-standing-desk', price: 59999, sku: 'HOME-001', stock: 20, cat: 3, featured: 1, status: 'active' },
      { name: 'Smart LED Desk Lamp', slug: 'smart-led-desk-lamp', price: 4999, sku: 'HOME-002', stock: 100, cat: 3, featured: 0, status: 'active' },
      { name: 'Indoor Plant Set (3 Pack)', slug: 'indoor-plant-set', price: 3499, sku: 'HOME-003', stock: 60, cat: 3, featured: 0, status: 'active' },
      { name: 'Memory Foam Pillow', slug: 'memory-foam-pillow', price: 5999, sku: 'HOME-004', stock: 90, cat: 3, featured: 0, status: 'active' },
      { name: 'Yoga Mat Premium', slug: 'yoga-mat-premium', price: 4499, sku: 'SPRT-001', stock: 120, cat: 4, featured: 0, status: 'active' },
      { name: 'Adjustable Dumbbells Set', slug: 'adjustable-dumbbells', price: 24999, sku: 'SPRT-002', stock: 25, cat: 4, featured: 1, status: 'active' },
      { name: 'Resistance Bands Pack', slug: 'resistance-bands', price: 1999, sku: 'SPRT-003', stock: 200, cat: 4, featured: 0, status: 'active' },
      { name: 'Smart Fitness Watch', slug: 'smart-fitness-watch', price: 19999, sku: 'SPRT-004', stock: 45, cat: 4, featured: 1, status: 'active' },
    ]
    const productRecords: any[] = []
    for (const p of products) {
      productRecords.push(await Product.create({
        name: p.name, slug: p.slug, description: `High-quality ${p.name.toLowerCase()}.`,
        price: p.price, compare_at_price: null, sku: p.sku,
        stock_quantity: p.stock, category_id: catRecords[p.cat]!.getAttribute('id'),
        status: p.status, featured: p.featured,
      }))
    }

    // Sample orders for customer
    const customerId = customer.getAttribute('id') as number
    const orderItems = [
      { productIdx: 0, qty: 1 }, // headphones
      { productIdx: 8, qty: 2 }, // clean code book x2
    ]
    let subtotal = 0
    for (const oi of orderItems) {
      subtotal += (productRecords[oi.productIdx]!.getAttribute('price') as number) * oi.qty
    }
    const tax = Math.round(subtotal * 0.085)
    const total = subtotal + tax

    const order1 = await Order.create({
      user_id: customerId, order_number: 'ORD-SEED-001', status: 'delivered',
      subtotal, tax, total,
      shipping_address: JSON.stringify({ street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62704', country: 'US' }),
      billing_address: JSON.stringify({ street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62704', country: 'US' }),
      notes: null, paid_at: new Date(Date.now() - 7 * 86400000).toISOString(), shipped_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    })
    const orderId = order1.getAttribute('id') as number
    for (const oi of orderItems) {
      const prod = productRecords[oi.productIdx]!
      const unitPrice = prod.getAttribute('price') as number
      await OrderItem.create({ order_id: orderId, product_id: prod.getAttribute('id') as number, quantity: oi.qty, unit_price: unitPrice, total: unitPrice * oi.qty })
    }
  }
}
