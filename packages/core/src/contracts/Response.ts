export interface CookieOptions {
  maxAge?: number
  expires?: Date
  path?: string
  domain?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

export interface MantiqResponseBuilder {
  status(code: number): this
  header(key: string, value: string): this
  withHeaders(headers: Record<string, string>): this
  cookie(name: string, value: string, options?: CookieOptions): this
  json(data: any): Response
  html(content: string): Response
  redirect(url: string): Response
}
