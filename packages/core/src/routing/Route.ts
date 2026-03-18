import type { HttpMethod, RouteAction, RouterRoute } from '../contracts/Router.ts'

export class Route implements RouterRoute {
  public routeName?: string
  public middlewareList: string[] = []
  public wheres: Record<string, RegExp> = {}

  constructor(
    public readonly methods: HttpMethod[],
    public readonly path: string,
    public readonly action: RouteAction,
  ) {}

  name(name: string): this {
    this.routeName = name
    return this
  }

  middleware(...middleware: string[]): this {
    this.middlewareList.push(...middleware)
    return this
  }

  where(param: string, pattern: string | RegExp): this {
    this.wheres[param] = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    return this
  }

  whereNumber(param: string): this {
    return this.where(param, /^\d+$/)
  }

  whereAlpha(param: string): this {
    return this.where(param, /^[a-zA-Z]+$/)
  }

  whereUuid(param: string): this {
    return this.where(param, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  }
}
