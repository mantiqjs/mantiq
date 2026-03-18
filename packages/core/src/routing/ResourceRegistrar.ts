import type { Constructor } from '../contracts/Container.ts'
import type { Router } from '../contracts/Router.ts'

const RESOURCE_METHODS = ['index', 'create', 'store', 'show', 'edit', 'update', 'destroy'] as const
const API_RESOURCE_METHODS = ['index', 'store', 'show', 'update', 'destroy'] as const

/**
 * Generates RESTful route sets for a controller.
 *
 * resource('photos', PhotoController) generates:
 *   GET    /photos           → index    (photos.index)
 *   GET    /photos/create    → create   (photos.create)
 *   POST   /photos           → store    (photos.store)
 *   GET    /photos/:photo    → show     (photos.show)
 *   GET    /photos/:photo/edit → edit   (photos.edit)
 *   PUT    /photos/:photo    → update   (photos.update)
 *   DELETE /photos/:photo    → destroy  (photos.destroy)
 *
 * apiResource omits create + edit (those are frontend pages).
 */
export class ResourceRegistrar {
  constructor(private readonly router: Router) {}

  register(name: string, controller: Constructor<any>, apiOnly = false): void {
    const methods = apiOnly ? API_RESOURCE_METHODS : RESOURCE_METHODS
    const param = this.singularize(name)
    const prefix = `/${name}`

    for (const method of methods) {
      switch (method) {
        case 'index':
          this.router.get(prefix, [controller, 'index']).name(`${name}.index`)
          break
        case 'create':
          this.router.get(`${prefix}/create`, [controller, 'create']).name(`${name}.create`)
          break
        case 'store':
          this.router.post(prefix, [controller, 'store']).name(`${name}.store`)
          break
        case 'show':
          this.router.get(`${prefix}/:${param}`, [controller, 'show']).name(`${name}.show`)
          break
        case 'edit':
          this.router.get(`${prefix}/:${param}/edit`, [controller, 'edit']).name(`${name}.edit`)
          break
        case 'update':
          this.router.match(['PUT', 'PATCH'], `${prefix}/:${param}`, [controller, 'update']).name(`${name}.update`)
          break
        case 'destroy':
          this.router.delete(`${prefix}/:${param}`, [controller, 'destroy']).name(`${name}.destroy`)
          break
      }
    }
  }

  private singularize(name: string): string {
    // Simple singularization for common cases
    const last = name.split('/').pop() ?? name
    if (last.endsWith('ies')) return last.slice(0, -3) + 'y'
    if (last.endsWith('ses') || last.endsWith('xes') || last.endsWith('zes')) return last.slice(0, -2)
    if (last.endsWith('s') && !last.endsWith('ss')) return last.slice(0, -1)
    return last
  }
}
