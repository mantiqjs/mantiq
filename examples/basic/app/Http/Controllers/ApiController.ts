import type { MantiqRequest } from '@mantiq/core'
import { json, config } from '@mantiq/core'

export class ApiController {
  /** GET /api/ping */
  ping(_request: MantiqRequest): Response {
    return json({
      status: 'ok',
      app: config('app.name'),
      env: config('app.env'),
      bun: Bun.version,
      timestamp: new Date().toISOString(),
    })
  }

  /** POST /api/echo — echoes the request body back */
  async echo(request: MantiqRequest): Promise<Response> {
    const body = await request.input()
    return json({
      echoed: body,
      method: request.method(),
      path: request.path(),
      headers: {
        'content-type': request.header('content-type'),
        'accept': request.header('accept'),
      },
    })
  }
}
