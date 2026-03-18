import { describe, it, expect, beforeEach } from 'bun:test'
import { Pipeline } from '../../src/middleware/Pipeline.ts'
import { ContainerImpl } from '../../src/container/Container.ts'
import type { Middleware, NextFunction } from '../../src/contracts/Middleware.ts'
import type { MantiqRequest } from '../../src/contracts/Request.ts'
import { MantiqRequest as MantiqRequestImpl } from '../../src/http/Request.ts'

function makeRequest(): MantiqRequest {
  return MantiqRequestImpl.fromBun(new Request('http://localhost/test'))
}

function makeContainer(...middlewareClasses: (new () => Middleware)[]): ContainerImpl {
  const container = new ContainerImpl()
  for (const cls of middlewareClasses) {
    container.bind(cls, () => new cls())
  }
  return container
}

describe('Pipeline', () => {
  it('executes-in-order: middleware runs A → B → C', async () => {
    const order: string[] = []

    class A implements Middleware {
      async handle(_req: MantiqRequest, next: NextFunction) {
        order.push('A:before')
        const res = await next()
        order.push('A:after')
        return res
      }
    }
    class B implements Middleware {
      async handle(_req: MantiqRequest, next: NextFunction) {
        order.push('B:before')
        const res = await next()
        order.push('B:after')
        return res
      }
    }
    class C implements Middleware {
      async handle(_req: MantiqRequest, next: NextFunction) {
        order.push('C:before')
        const res = await next()
        order.push('C:after')
        return res
      }
    }

    const container = makeContainer(A, B, C)
    await new Pipeline(container)
      .send(makeRequest())
      .through([A, B, C])
      .then(async () => new Response('ok'))

    expect(order).toEqual(['A:before', 'B:before', 'C:before', 'C:after', 'B:after', 'A:after'])
  })

  it('short-circuit: middleware returns without calling next', async () => {
    const order: string[] = []

    class Blocker implements Middleware {
      async handle(_req: MantiqRequest, _next: NextFunction) {
        order.push('blocker')
        return new Response('blocked', { status: 403 })
      }
    }
    class Never implements Middleware {
      async handle(_req: MantiqRequest, next: NextFunction) {
        order.push('never')
        return next()
      }
    }

    const container = makeContainer(Blocker, Never)
    const response = await new Pipeline(container)
      .send(makeRequest())
      .through([Blocker, Never])
      .then(async () => { order.push('destination'); return new Response('ok') })

    expect(response.status).toBe(403)
    expect(order).toEqual(['blocker'])
  })

  it('modify-request: middleware can set data on request', async () => {
    let seenUser: any = null

    class SetUser implements Middleware {
      async handle(req: MantiqRequest, next: NextFunction) {
        req.setUser({ id: 1, name: 'Alice' })
        return next()
      }
    }

    const container = makeContainer(SetUser)
    await new Pipeline(container)
      .send(makeRequest())
      .through([SetUser])
      .then(async (req) => {
        seenUser = req.user()
        return new Response('ok')
      })

    expect(seenUser).toEqual({ id: 1, name: 'Alice' })
  })

  it('modify-response: middleware can wrap and modify the response', async () => {
    class AddHeader implements Middleware {
      async handle(_req: MantiqRequest, next: NextFunction) {
        const res = await next()
        const headers = new Headers(res.headers)
        headers.set('X-Added', 'true')
        return new Response(res.body, { status: res.status, headers })
      }
    }

    const container = makeContainer(AddHeader)
    const response = await new Pipeline(container)
      .send(makeRequest())
      .through([AddHeader])
      .then(async () => new Response('ok'))

    expect(response.headers.get('X-Added')).toBe('true')
  })

  it('terminable-runs-after: terminate() is called after response', async () => {
    const log: string[] = []

    class Terminable implements Middleware {
      async handle(_req: MantiqRequest, next: NextFunction) {
        return next()
      }
      async terminate(_req: MantiqRequest, _res: Response) {
        log.push('terminated')
      }
    }

    const container = makeContainer(Terminable)
    const pipeline = new Pipeline(container).send(makeRequest()).through([Terminable])
    const response = await pipeline.then(async () => new Response('ok'))
    await pipeline.terminate(response)

    expect(log).toContain('terminated')
  })

  it('empty-pipeline: runs destination directly with no middleware', async () => {
    const container = new ContainerImpl()
    const response = await new Pipeline(container)
      .send(makeRequest())
      .through([])
      .then(async () => new Response('direct', { status: 200 }))

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('direct')
  })
})
