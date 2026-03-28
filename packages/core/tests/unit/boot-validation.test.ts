import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test'
import { HttpKernel } from '../../src/http/Kernel.ts'
import { ContainerImpl } from '../../src/container/Container.ts'
import { ConfigRepository } from '../../src/config/ConfigRepository.ts'
import { CoreServiceProvider } from '../../src/providers/CoreServiceProvider.ts'
import { Application } from '../../src/application/Application.ts'
import { RouterImpl } from '../../src/routing/Router.ts'
import { DefaultExceptionHandler } from '../../src/exceptions/Handler.ts'
import { WebSocketKernel } from '../../src/websocket/WebSocketKernel.ts'
import type { Middleware, NextFunction } from '../../src/contracts/Middleware.ts'
import type { MantiqRequest } from '../../src/contracts/Request.ts'

// Dummy middleware class for registration tests
class DummyMiddleware implements Middleware {
  async handle(_req: MantiqRequest, next: NextFunction) {
    return next()
  }
}

function makeKernel(): HttpKernel {
  const container = new ContainerImpl()
  const config = new ConfigRepository({ app: {} })
  container.instance(ConfigRepository, config)
  const router = new RouterImpl(config)
  const exHandler = new DefaultExceptionHandler()
  const wsKernel = new WebSocketKernel()
  return new HttpKernel(container, router, exHandler, wsKernel)
}

describe('HttpKernel middleware introspection', () => {
  it('hasMiddleware returns false for unregistered alias', () => {
    const kernel = makeKernel()
    expect(kernel.hasMiddleware('unknown')).toBe(false)
  })

  it('hasMiddleware returns true after registerMiddleware', () => {
    const kernel = makeKernel()
    kernel.registerMiddleware('dummy', DummyMiddleware)
    expect(kernel.hasMiddleware('dummy')).toBe(true)
  })

  it('getRegisteredAliases returns all registered alias names', () => {
    const kernel = makeKernel()
    kernel.registerMiddleware('a', DummyMiddleware)
    kernel.registerMiddleware('b', DummyMiddleware)
    expect(kernel.getRegisteredAliases()).toEqual(['a', 'b'])
  })
})

describe('CoreServiceProvider boot-time validation', () => {
  let savedEnv: Record<string, string | undefined>

  beforeEach(() => {
    savedEnv = {
      APP_KEY: process.env['APP_KEY'],
      APP_ENV: process.env['APP_ENV'],
      APP_DEBUG: process.env['APP_DEBUG'],
    }
  })

  afterEach(() => {
    // Restore env vars
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = val
      }
    }
  })

  it('throws when middleware group references unknown alias', async () => {
    const container = new ContainerImpl()
    // Generate a valid APP_KEY so encryption doesn't block us
    const key = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')
    const config = new ConfigRepository({
      app: {
        key: `base64:${key}`,
        middlewareGroups: {
          web: ['nonexistent-alias'],
        },
      },
    })
    container.instance(ConfigRepository, config)

    // Register the full provider so register() sets up middleware aliases
    const provider = new CoreServiceProvider(container)
    await provider.register()

    await expect(provider.boot()).rejects.toThrow(
      "Middleware group 'web' references unknown alias 'nonexistent-alias'",
    )
  })

  it('throws when encrypt.cookies is active but APP_KEY is missing', async () => {
    const container = new ContainerImpl()
    const config = new ConfigRepository({
      app: {
        key: '', // empty key, same as env('APP_KEY', '') when unset
        middlewareGroups: {
          web: ['encrypt.cookies'],
        },
      },
    })
    container.instance(ConfigRepository, config)

    const provider = new CoreServiceProvider(container)
    await provider.register()

    await expect(provider.boot()).rejects.toThrow(
      'APP_KEY is required when encrypt.cookies middleware is active',
    )
  })

  it('passes validation with valid middleware groups and APP_KEY', async () => {
    const container = new ContainerImpl()
    const key = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')
    const config = new ConfigRepository({
      app: {
        key: `base64:${key}`,
        middlewareGroups: {
          web: ['cors', 'encrypt.cookies', 'session', 'csrf'],
          api: ['cors', 'throttle'],
        },
      },
    })
    container.instance(ConfigRepository, config)

    const provider = new CoreServiceProvider(container)
    await provider.register()

    // Should not throw
    await expect(provider.boot()).resolves.toBeUndefined()
  })

  it('passes when middleware groups have no encrypt.cookies and no APP_KEY', async () => {
    const container = new ContainerImpl()
    const config = new ConfigRepository({
      app: {
        key: '', // no key, but no encrypt.cookies either
        middlewareGroups: {
          api: ['cors', 'throttle'],
        },
      },
    })
    container.instance(ConfigRepository, config)

    const provider = new CoreServiceProvider(container)
    await provider.register()

    // Should not throw
    await expect(provider.boot()).resolves.toBeUndefined()
  })
})

describe('Application.validateEnvironment', () => {
  let savedEnv: Record<string, string | undefined>

  beforeEach(() => {
    savedEnv = {
      APP_KEY: process.env['APP_KEY'],
      APP_ENV: process.env['APP_ENV'],
      APP_DEBUG: process.env['APP_DEBUG'],
    }
  })

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = val
      }
    }
    Application.resetInstance()
  })

  it('throws when APP_ENV is not set', () => {
    delete process.env['APP_ENV']
    const app = Object.create(Application.prototype)
    expect(() => app.validateEnvironment()).toThrow('APP_ENV is not set')
  })

  it('throws when APP_KEY does not start with base64:', () => {
    process.env['APP_ENV'] = 'local'
    process.env['APP_KEY'] = 'not-a-valid-key'
    const app = Object.create(Application.prototype)
    expect(() => app.validateEnvironment()).toThrow('APP_KEY must start with "base64:"')
  })

  it('throws when APP_KEY decodes to wrong byte length', () => {
    process.env['APP_ENV'] = 'local'
    // 16 bytes instead of 32
    const shortKey = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64')
    process.env['APP_KEY'] = `base64:${shortKey}`
    const app = Object.create(Application.prototype)
    expect(() => app.validateEnvironment()).toThrow('APP_KEY must decode to exactly 32 bytes')
  })

  it('passes with valid APP_ENV and valid APP_KEY', () => {
    process.env['APP_ENV'] = 'local'
    const validKey = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')
    process.env['APP_KEY'] = `base64:${validKey}`
    const app = Object.create(Application.prototype)
    expect(() => app.validateEnvironment()).not.toThrow()
  })

  it('passes with APP_ENV set and no APP_KEY', () => {
    process.env['APP_ENV'] = 'local'
    delete process.env['APP_KEY']
    const app = Object.create(Application.prototype)
    expect(() => app.validateEnvironment()).not.toThrow()
  })

  it('warns when APP_DEBUG=true in production', () => {
    process.env['APP_ENV'] = 'production'
    process.env['APP_DEBUG'] = 'true'
    delete process.env['APP_KEY']

    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    const app = Object.create(Application.prototype)
    app.validateEnvironment()

    expect(warnSpy).toHaveBeenCalledWith(
      '[Mantiq] WARNING: APP_DEBUG=true in production. This may expose sensitive data.',
    )
    warnSpy.mockRestore()
  })

  it('does not warn when APP_DEBUG=true in non-production', () => {
    process.env['APP_ENV'] = 'local'
    process.env['APP_DEBUG'] = 'true'
    delete process.env['APP_KEY']

    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    const app = Object.create(Application.prototype)
    app.validateEnvironment()

    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
