import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { Plan } from '../../Models/Plan.ts'

export class PlanController {
  async index(_request: MantiqRequest): Promise<Response> {
    const plans = await Plan.where('is_active', 1).get() as any[]

    return MantiqResponse.json({
      data: plans.map((p: any) => p.toObject()),
    })
  }

  async show(request: MantiqRequest): Promise<Response> {
    const id = Number(request.param('id'))
    const plan = await Plan.find(id)

    if (!plan) {
      return MantiqResponse.json({ message: 'Plan not found.' }, 404)
    }

    return MantiqResponse.json({ data: plan.toObject() })
  }
}
