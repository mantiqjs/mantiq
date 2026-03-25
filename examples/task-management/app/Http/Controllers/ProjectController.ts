import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Project } from '../../Models/Project.ts'
import { Task } from '../../Models/Task.ts'
import { User } from '../../Models/User.ts'

export class ProjectController {
  // ── GET /api/projects ─────────────────────────────────────────────────────
  async index(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const page = Math.max(1, Number(request.query('page') ?? 1))
    const perPage = Math.min(50, Math.max(1, Number(request.query('per_page') ?? 15)))
    const statusFilter = request.query('status')

    const userId = authUser.getAuthIdentifier()

    // Admins see all projects; others see owned or assigned-to projects
    let projects: any[]
    let total: number

    if (authUser.isAdmin()) {
      let query = Project.query() as any
      if (statusFilter) query = query.where('status', statusFilter)

      total = await (statusFilter
        ? (Project.query() as any).where('status', statusFilter).count()
        : (Project.query() as any).count()) as number

      projects = await query
        .orderBy('created_at', 'desc')
        .limit(perPage)
        .offset((page - 1) * perPage)
        .get() as any[]
    } else {
      // Get project IDs where user owns or has tasks assigned
      const ownedProjects = await Project.where('user_id', userId).get() as any[]
      const assignedTasks = await Task.where('assignee_id', userId).get() as any[]
      const projectIdSet = new Set<number>()
      for (const p of ownedProjects) projectIdSet.add(p.getAttribute('id') as number)
      for (const t of assignedTasks) projectIdSet.add(t.getAttribute('project_id') as number)

      const projectIds = [...projectIdSet]
      if (projectIds.length === 0) {
        return MantiqResponse.json({
          data: [],
          meta: { total: 0, page, per_page: perPage, last_page: 1 },
        })
      }

      // Fetch projects by IDs with optional status filter
      let allFiltered: any[] = []
      for (const pid of projectIds) {
        let q = Project.query().where('id', pid) as any
        if (statusFilter) q = q.where('status', statusFilter)
        const found = await q.get() as any[]
        allFiltered.push(...found)
      }

      total = allFiltered.length
      // Sort by created_at desc and paginate manually
      allFiltered.sort((a: any, b: any) => {
        const aDate = a.getAttribute('created_at') ?? ''
        const bDate = b.getAttribute('created_at') ?? ''
        return bDate > aDate ? 1 : bDate < aDate ? -1 : 0
      })
      projects = allFiltered.slice((page - 1) * perPage, page * perPage)
    }

    // Enrich with task counts
    const data = []
    for (const project of projects) {
      const projectId = project.getAttribute('id') as number
      const taskCount = await (Task.query().where('project_id', projectId) as any).count() as number
      const obj = project.toObject()
      obj.task_count = taskCount
      data.push(obj)
    }

    return MantiqResponse.json({
      data,
      meta: {
        total,
        page,
        per_page: perPage,
        last_page: Math.max(1, Math.ceil(total / perPage)),
      },
    })
  }

  // ── GET /api/projects/:id ─────────────────────────────────────────────────
  async show(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const id = Number(request.param('id'))
    const project = await Project.find(id)
    if (!project) return MantiqResponse.json({ error: 'Project not found.' }, 404)

    // Task summary by status
    const tasks = await Task.where('project_id', id).get() as any[]
    const statusCounts: Record<string, number> = { todo: 0, in_progress: 0, in_review: 0, done: 0 }
    for (const task of tasks) {
      const s = task.getAttribute('status') as string
      if (s in statusCounts) statusCounts[s]!++
    }

    // Get owner name
    const owner = await User.find(project.getAttribute('user_id') as number)

    return MantiqResponse.json({
      data: {
        ...project.toObject(),
        owner: owner ? { id: owner.getAuthIdentifier(), name: owner.getAttribute('name') } : null,
        task_summary: {
          total: tasks.length,
          ...statusCounts,
        },
      },
    })
  }

  // ── POST /api/projects ────────────────────────────────────────────────────
  async store(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const body = await request.input() as {
      name?: string; description?: string; color?: string
    }

    // ── Validation ──────────────────────────────────────────────────────────
    const errors: Record<string, string> = {}

    if (!body.name || body.name.trim().length === 0) {
      errors.name = 'Project name is required.'
    } else if (body.name.trim().length > 100) {
      errors.name = 'Project name must not exceed 100 characters.'
    }

    if (body.color && !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
      errors.color = 'Color must be a valid hex color (e.g. #6366f1).'
    }

    if (Object.keys(errors).length > 0) {
      return MantiqResponse.json({ errors }, 422)
    }

    const project = await Project.create({
      name: body.name!.trim(),
      description: body.description?.trim() ?? null,
      user_id: authUser.getAuthIdentifier(),
      status: 'active',
      color: body.color ?? '#6366f1',
    })

    return MantiqResponse.json({ data: project.toObject() }, 201)
  }

  // ── PUT /api/projects/:id ─────────────────────────────────────────────────
  async update(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const id = Number(request.param('id'))
    const project = await Project.find(id)
    if (!project) return MantiqResponse.json({ error: 'Project not found.' }, 404)

    // Authorization: must be owner or admin
    const ownerId = project.getAttribute('user_id') as number
    if (ownerId !== authUser.getAuthIdentifier() && !authUser.isAdmin()) {
      return MantiqResponse.json({ error: 'You are not authorized to update this project.' }, 403)
    }

    const body = await request.input() as {
      name?: string; description?: string; color?: string; status?: string
    }

    const errors: Record<string, string> = {}

    if (body.name !== undefined) {
      if (body.name.trim().length === 0) {
        errors.name = 'Project name cannot be empty.'
      } else if (body.name.trim().length > 100) {
        errors.name = 'Project name must not exceed 100 characters.'
      }
    }

    if (body.color && !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
      errors.color = 'Color must be a valid hex color (e.g. #6366f1).'
    }

    if (body.status && !['active', 'archived'].includes(body.status)) {
      errors.status = 'Status must be active or archived.'
    }

    if (Object.keys(errors).length > 0) {
      return MantiqResponse.json({ errors }, 422)
    }

    if (body.name !== undefined) project.setAttribute('name', body.name.trim())
    if (body.description !== undefined) project.setAttribute('description', body.description?.trim() ?? null)
    if (body.color !== undefined) project.setAttribute('color', body.color)
    if (body.status !== undefined) project.setAttribute('status', body.status)

    await project.save()

    return MantiqResponse.json({ data: project.toObject() })
  }

  // ── DELETE /api/projects/:id ──────────────────────────────────────────────
  async destroy(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const id = Number(request.param('id'))
    const project = await Project.find(id)
    if (!project) return MantiqResponse.json({ error: 'Project not found.' }, 404)

    // Authorization: must be owner or admin
    const ownerId = project.getAttribute('user_id') as number
    if (ownerId !== authUser.getAuthIdentifier() && !authUser.isAdmin()) {
      return MantiqResponse.json({ error: 'You are not authorized to delete this project.' }, 403)
    }

    // Cascade: delete task_labels for tasks in this project, then tasks
    const tasks = await Task.where('project_id', id).get() as any[]
    const { TaskLabel } = await import('../../Models/TaskLabel.ts')
    const { Label } = await import('../../Models/Label.ts')

    for (const task of tasks) {
      const taskId = task.getAttribute('id') as number
      const pivots = await TaskLabel.where('task_id', taskId).get() as any[]
      for (const pivot of pivots) await pivot.delete()
      await task.delete()
    }

    // Delete labels for this project
    const labels = await Label.where('project_id', id).get() as any[]
    for (const label of labels) await label.delete()

    await project.delete()

    return MantiqResponse.json({ message: 'Project deleted successfully.' })
  }

  // ── PATCH /api/projects/:id/archive ───────────────────────────────────────
  async archive(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const id = Number(request.param('id'))
    const project = await Project.find(id)
    if (!project) return MantiqResponse.json({ error: 'Project not found.' }, 404)

    // Authorization: must be owner or admin
    const ownerId = project.getAttribute('user_id') as number
    if (ownerId !== authUser.getAuthIdentifier() && !authUser.isAdmin()) {
      return MantiqResponse.json({ error: 'You are not authorized to modify this project.' }, 403)
    }

    // Toggle archive status
    const currentStatus = project.getAttribute('status') as string
    const newStatus = currentStatus === 'archived' ? 'active' : 'archived'
    project.setAttribute('status', newStatus)
    await project.save()

    return MantiqResponse.json({
      data: project.toObject(),
      message: newStatus === 'archived' ? 'Project archived.' : 'Project unarchived.',
    })
  }
}
