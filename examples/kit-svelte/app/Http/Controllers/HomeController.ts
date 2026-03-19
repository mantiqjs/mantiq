import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse, config } from '@mantiq/core'

export class HomeController {
  async index(_request: MantiqRequest): Promise<Response> {
    return MantiqResponse.json({
      message: `Welcome to ${config('app.name')}!`,
      version: '0.0.1',
    })
  }
}
