import type { Router } from '@mantiq/core'
import { AuthController } from '../app/Http/Controllers/AuthController.ts'
import { ProductController } from '../app/Http/Controllers/ProductController.ts'
import { CategoryController } from '../app/Http/Controllers/CategoryController.ts'
import { CartController } from '../app/Http/Controllers/CartController.ts'
import { OrderController } from '../app/Http/Controllers/OrderController.ts'

export default function (router: Router) {
  const auth = new AuthController()
  const product = new ProductController()
  const category = new CategoryController()
  const cart = new CartController()
  const order = new OrderController()

  // Auth
  router.post('/api/auth/register', async (req) => auth.register(req))
  router.post('/api/auth/login', async (req) => auth.login(req))
  router.post('/api/auth/logout', async (req) => auth.logout(req)).middleware('auth')
  router.get('/api/auth/me', async (req) => auth.me(req)).middleware('auth')

  // Products (public read, auth for write)
  router.get('/api/products', async (req) => product.index(req))
  router.get('/api/products/:id', async (req) => product.show(req)).whereNumber('id')
  router.post('/api/products', async (req) => product.store(req)).middleware('auth')
  router.put('/api/products/:id', async (req) => product.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/products/:id', async (req) => product.destroy(req)).whereNumber('id').middleware('auth')

  // Categories (public read, auth for write)
  router.get('/api/categories', async (req) => category.index(req))
  router.get('/api/categories/:id', async (req) => category.show(req)).whereNumber('id')
  router.post('/api/categories', async (req) => category.store(req)).middleware('auth')
  router.put('/api/categories/:id', async (req) => category.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/categories/:id', async (req) => category.destroy(req)).whereNumber('id').middleware('auth')

  // Cart (all auth)
  router.get('/api/cart', async (req) => cart.index(req)).middleware('auth')
  router.post('/api/cart', async (req) => cart.add(req)).middleware('auth')
  router.put('/api/cart/:id', async (req) => cart.update(req)).whereNumber('id').middleware('auth')
  router.delete('/api/cart/:id', async (req) => cart.remove(req)).whereNumber('id').middleware('auth')
  router.delete('/api/cart', async (req) => cart.clear(req)).middleware('auth')

  // Orders (all auth)
  router.get('/api/orders', async (req) => order.index(req)).middleware('auth')
  router.get('/api/orders/:id', async (req) => order.show(req)).whereNumber('id').middleware('auth')
  router.post('/api/orders/checkout', async (req) => order.checkout(req)).middleware('auth')
  router.patch('/api/orders/:id/cancel', async (req) => order.cancel(req)).whereNumber('id').middleware('auth')
  router.patch('/api/orders/:id/status', async (req) => order.updateStatus(req)).whereNumber('id').middleware('auth')
}
