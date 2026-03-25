import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Label } from '../../Models/Label.ts'
import { Project } from '../../Models/Project.ts'
import { Task } from '../../Models/Task.ts'
import { TaskLabel } from '../../Models/TaskLabel.ts'
import { User } from '../../Models/User.ts'

export class LabelController {
  // ── GET /api/projects/:projectId/labels ───────────────────────────────────
  async index(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const projectId = Number(request.param('projectId'))
    const project = await Project.find(projectId)
    if (!project) return MantiqResponse.json({ error: 'Project not found.' }, 404)

    const labels = await Label.where('project_id', projectId)
      .orderBy('name', 'asc')
      .get() as any[]

    // Enrich with usage count
    const data = []
    for (const label of labels) {
      const labelId = label.getAttribute('id') as number
      const usageCount = await (TaskLabel.query().where('label_id', labelId) as any).count() as number
      const obj = label.toObject()
      obj.task_count = usageCount
      data.push(obj)
    }

    return MantiqResponse.json({ data })
  }

  // ── POST /api/projects/:projectId/labels ──────────────────────────────────
  async store(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const projectId = Number(request.param('projectId'))
    const project = await Project.find(projectId)
    if (!project) return MantiqResponse.json({ error: 'Project not found.' }, 404)

    const body = await request.input() as { name?: string; color?: string }

    // ── Validation ──────────────────────────────────────────────────────────
    const errors: Record<string, string> = {}

    if (!body.name || body.name.trim().length === 0) {
      errors.name = 'Label name is required.'
    } else if (body.name.trim().length > 50) {
      errors.name = 'Label name must not exceed 50 characters.'
    }

    if (body.color && !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
      errors.color = 'Color must be a valid hex color (e.g. #6b7280).'
    }

    if (Object.keys(errors).length > 0) {
      return MantiqResponse.json({ errors }, 422)
    }

    // Check for duplicate label name in the same project
    const existing = await Label.where('project_id', projectId)
      .where('name', body.name!.trim())
      .first()
    if (existing) {
      return MantiqResponse.json({ errors: { name: 'A label with this name already exists in the project.' } }, 422)
    }

    const label = await Label.create({
      name: body.name!.trim(),
      color: body.color ?? '#6b7280',
      project_id: projectId,
    })

    return MantiqResponse.json({ data: label.toObject() }, 201)
  }

  // ── PUT /api/labels/:id ───────────────────────────────────────────────────
  async update(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const id = Number(request.param('id'))
    const label = await Label.find(id)
    if (!label) return MantiqResponse.json({ error: 'Label not found.' }, 404)

    const body = await request.input() as { name?: string; color?: string }

    const errors: Record<string, string> = {}

    if (body.name !== undefined) {
      if (body.name.trim().length === 0) {
        errors.name = 'Label name cannot be empty.'
      } else if (body.name.trim().length > 50) {
        errors.name = 'Label name must not exceed 50 characters.'
      }
    }

    if (body.color && !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
      errors.color = 'Color must be a valid hex color (e.g. #6b7280).'
    }

    if (Object.keys(errors).length > 0) {
      return MantiqResponse.json({ errors }, 422)
    }

    // Check duplicate name within the same project (exclude self)
    if (body.name !== undefined) {
      const projectId = label.getAttribute('project_id') as number
      const existing = await Label.where('project_id', projectId)
        .where('name', body.name.trim())
        .first() as any
      if (existing && (existing.getAttribute('id') as number) !== id) {
        return MantiqResponse.json({ errors: { name: 'A label with this name already exists in the project.' } }, 422)
      }
      label.setAttribute('name', body.name.trim())
    }

    if (body.color !== undefined) label.setAttribute('color', body.color)

    await label.save()

    return MantiqResponse.json({ data: label.toObject() })
  }

  // ── DELETE /api/labels/:id ────────────────────────────────────────────────
  async destroy(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const id = Number(request.param('id'))
    const label = await Label.find(id)
    if (!label) return MantiqResponse.json({ error: 'Label not found.' }, 404)

    // Remove all task_label pivots for this label
    const pivots = await TaskLabel.where('label_id', id).get() as any[]
    for (const pivot of pivots) await pivot.delete()

    await label.delete()

    return MantiqResponse.json({ message: 'Label deleted successfully.' })
  }

  // ── POST /api/tasks/:taskId/labels/:labelId ───────────────────────────────
  async attach(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const taskId = Number(request.param('taskId'))
    const labelId = Number(request.param('labelId'))

    const task = await Task.find(taskId)
    if (!task) return MantiqResponse.json({ error: 'Task not found.' }, 404)

    const label = await Label.find(labelId)
    if (!label) return MantiqResponse.json({ error: 'Label not found.' }, 404)

    // Verify label belongs to the same project as the task
    const taskProjectId = task.getAttribute('project_id') as number
    const labelProjectId = label.getAttribute('project_id') as number
    if (taskProjectId !== labelProjectId) {
      return MantiqResponse.json({ error: 'Label does not belong to the same project as the task.' }, 422)
    }

    // Check if already attached
    const existing = await TaskLabel.where('task_id', taskId)
      .where('label_id', labelId)
      .first()
    if (existing) {
      return MantiqResponse.json({ message: 'Label already attached to task.' })
    }

    await TaskLabel.create({ task_id: taskId, label_id: labelId })

    return MantiqResponse.json({ message: 'Label attached to task.' }, 201)
  }

  // ── DELETE /api/tasks/:taskId/labels/:labelId ─────────────────────────────
  async detach(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const taskId = Number(request.param('taskId'))
    const labelId = Number(request.param('labelId'))

    const pivot = await TaskLabel.where('task_id', taskId)
      .where('label_id', labelId)
      .first() as any
    if (!pivot) {
      return MantiqResponse.json({ error: 'Label is not attached to this task.' }, 404)
    }

    await pivot.delete()

    return MantiqResponse.json({ message: 'Label detached from task.' })
  }
}
