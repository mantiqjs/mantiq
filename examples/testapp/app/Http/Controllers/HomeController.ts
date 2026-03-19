import type { MantiqRequest } from '@mantiq/core'
import { json, config } from '@mantiq/core'

export class HomeController {
  async index(_request: MantiqRequest): Promise<Response> {
    return json({
      message: `Welcome to ${config('app.name')}!`,
      version: '0.0.1',
    })
  }
}
