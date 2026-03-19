import type { Constructor } from './Container.ts'
import type { MantiqRequest } from './Request.ts'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

export type RouteAction =
  | [Constructor<any>, string]
  | ((request: MantiqRequest) => any)
  | string

export interface RouteGroupOptions {
  prefix?: string
  middleware?: string[]
  as?: string
  namespace?: string
}

export interface RouteMatch {
  action: RouteAction
  params: Record<string, any>
  middleware: string[]
  routeName?: string
}

export interface RouteDefinition {
  method: HttpMethod | HttpMethod[]
  path: string
  action: RouteAction
  name?: string
  middleware: string[]
  wheres: Record<string, RegExp>
}

export interface Router {
  get(path: string, action: RouteAction): RouterRoute
  post(path: string, action: RouteAction): RouterRoute
  put(path: string, action: RouteAction): RouterRoute
  patch(path: string, action: RouteAction): RouterRoute
  delete(path: string, action: RouteAction): RouterRoute
  options(path: string, action: RouteAction): RouterRoute
  match(methods: HttpMethod[], path: string, action: RouteAction): RouterRoute
  any(path: string, action: RouteAction): RouterRoute
  resource(name: string, controller: Constructor<any>): void
  apiResource(name: string, controller: Constructor<any>): void
  group(options: RouteGroupOptions, callback: (router: Router) => void): void
  url(name: string, params?: Record<string, any>, absolute?: boolean): string
  resolve(request: MantiqRequest): RouteMatch
  routes(): RouteDefinition[]
  model(param: string, model: Constructor<any>): void
  bind(param: string, resolver: (value: string) => Promise<any>): void
  /** Register controller classes for string-based resolution ('AuthController@login') */
  controllers(map: Record<string, Constructor<any>>): void
}

export interface RouterRoute {
  name(name: string): this
  middleware(...middleware: string[]): this
  where(param: string, pattern: string | RegExp): this
  whereNumber(param: string): this
  whereAlpha(param: string): this
  whereUuid(param: string): this
}
