import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Task } from '../../Models/Task.ts'
import { Project } from '../../Models/Project.ts'
import { TaskLabel } from '../../Models/TaskLabel.ts'
import { Label } from '../../Models/Label.ts'
import { User } from '../../Models/User.ts'

export class TaskController {
  // ── GET /api/projects/:projectId/tasks ────────────────────────────────────
  async index(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const projectId = Number(request.param('projectId'))
    const project = await Project.find(projectId)
    if (!project) return MantiqResponse.json({ error: 'Project not found.' }, 404)

    const page = Math.max(1, Number(request.query('page') ?? 1))
    const perPage = Math.min(100, Math.max(1, Number(request.query('per_page') ?? 20)))
    const statusFilter = request.query('status')
    const priorityFilter = request.query('priority')
    const assigneeFilter = request.query('assignee_id')
    const sortBy = request.query('sort') ?? 'position'
    const sortDir = request.query('dir') === 'desc' ? 'desc' : 'asc'

    // Build filtered task list
    let allTasks = await Task.where('project_id', projectId).get() as any[]

    // Apply filters
    if (statusFilter) {
      allTasks = allTasks.filter((t: any) => t.getAttribute('status') === statusFilter)
    }
    if (priorityFilter) {
      allTasks = allTasks.filter((t: any) => t.getAttribute('priority') === priorityFilter)
    }
    if (assigneeFilter) {
      const aid = Number(assigneeFilter)
      allTasks = allTasks.filter((t: any) => t.getAttribute('assignee_id') === aid)
    }

    const total = allTasks.length

    // Sort
    allTasks.sort((a: any, b: any) => {
      const aVal = a.getAttribute(sortBy) ?? ''
      const bVal = b.getAttribute(sortBy) ?? ''
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    // Paginate
    const tasks = allTasks.slice((page - 1) * perPage, page * perPage)

    // Enrich with assignee and reporter names
    const data = []
    for (const task of tasks) {
      const obj = task.toObject()

      const assigneeId = task.getAttribute('assignee_id') as number | null
      if (assigneeId) {
        const assignee = await User.find(assigneeId)
        obj.assignee = assignee
          ? { id: assignee.getAuthIdentifier(), name: assignee.getAttribute('name') }
          : null
      } else {
        obj.assignee = null
      }

      const reporterId = task.getAttribute('reporter_id') as number
      const reporter = await User.find(reporterId)
      obj.reporter = reporter
        ? { id: reporter.getAuthIdentifier(), name: reporter.getAttribute('name') }
        : null

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

  // ── GET /api/tasks/:id ────────────────────────────────────────────────────
  async show(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const id = Number(request.param('id'))
    const task = await Task.find(id)
    if (!task) return MantiqResponse.json({ error: 'Task not found.' }, 404)

    const obj = task.toObject()

    // Include labels
    const pivots = await TaskLabel.where('task_id', id).get() as any[]
    const labels = []
    for (const pivot of pivots) {
      const label = await Label.find(pivot.getAttribute('label_id') as number)
      if (label) labels.push(label.toObject())
    }
    obj.labels = labels

    // Include assignee
    const assigneeId = task.getAttribute('assignee_id') as number | null
    if (assigneeId) {
      const assignee = await User.find(assigneeId)
      obj.assignee = assignee
        ? { id: assignee.getAuthIdentifier(), name: assignee.getAttribute('name') }
        : null
    } else {
      obj.assignee = null
    }

    // Include reporter
    const reporterId = task.getAttribute('reporter_id') as number
    const reporter = await User.find(reporterId)
    obj.reporter = reporter
      ? { id: reporter.getAuthIdentifier(), name: reporter.getAttribute('name') }
      : null

    // Include project info
    const project = await Project.find(task.getAttribute('project_id') as number)
    obj.project = project
      ? { id: project.getAttribute('id'), name: project.getAttribute('name') }
      : null

    return MantiqResponse.json({ data: obj })
  }

  // ── POST /api/projects/:projectId/tasks ───────────────────────────────────
  async store(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const projectId = Number(request.param('projectId'))
    const project = await Project.find(projectId)
    if (!project) return MantiqResponse.json({ error: 'Project not found.' }, 404)

    const body = await request.input() as {
      title?: string; description?: string; assignee_id?: number
      priority?: string; due_date?: string; status?: string
    }

    // ── Validation ──────────────────────────────────────────────────────────
    const errors: Record<string, string> = {}

    if (!body.title || body.title.trim().length === 0) {
      errors.title = 'Task title is required.'
    } else if (body.title.trim().length > 200) {
      errors.title = 'Task title must not exceed 200 characters.'
    }

    if (body.priority && !(Task.VALID_PRIORITIES as readonly string[]).includes(body.priority)) {
      errors.priority = `Priority must be one of: ${Task.VALID_PRIORITIES.join(', ')}.`
    }

    if (body.status && !(Task.VALID_STATUSES as readonly string[]).includes(body.status)) {
      errors.status = `Status must be one of: ${Task.VALID_STATUSES.join(', ')}.`
    }

    if (body.assignee_id) {
      const assignee = await User.find(Number(body.assignee_id))
      if (!assignee) errors.assignee_id = 'Assignee user not found.'
    }

    if (body.due_date) {
      const parsed = new Date(body.due_date)
      if (isNaN(parsed.getTime())) errors.due_date = 'Due date must be a valid date.'
    }

    if (Object.keys(errors).length > 0) {
      return MantiqResponse.json({ errors }, 422)
    }

    // Determine next position
    const existingTasks = await Task.where('project_id', projectId).get() as any[]
    let maxPosition = 0
    for (const t of existingTasks) {
      const pos = t.getAttribute('position') as number
      if (pos > maxPosition) maxPosition = pos
    }

    const task = await Task.create({
      title: body.title!.trim(),
      description: body.description?.trim() ?? null,
      project_id: projectId,
      assignee_id: body.assignee_id ? Number(body.assignee_id) : null,
      reporter_id: authUser.getAuthIdentifier(),
      status: body.status ?? 'todo',
      priority: body.priority ?? 'medium',
      due_date: body.due_date ?? null,
      completed_at: null,
      position: maxPosition + 1,
    })

    return MantiqResponse.json({ data: task.toObject() }, 201)
  }

  // ── PUT /api/tasks/:id ────────────────────────────────────────────────────
  async update(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const id = Number(request.param('id'))
    const task = await Task.find(id)
    if (!task) return MantiqResponse.json({ error: 'Task not found.' }, 404)

    const body = await request.input() as {
      title?: string; description?: string; priority?: string; due_date?: string | null
    }

    const errors: Record<string, string> = {}

    if (body.title !== undefined) {
      if (body.title.trim().length === 0) {
        errors.title = 'Task title cannot be empty.'
      } else if (body.title.trim().length > 200) {
        errors.title = 'Task title must not exceed 200 characters.'
      }
    }

    if (body.priority && !(Task.VALID_PRIORITIES as readonly string[]).includes(body.priority)) {
      errors.priority = `Priority must be one of: ${Task.VALID_PRIORITIES.join(', ')}.`
    }

    if (body.due_date !== undefined && body.due_date !== null) {
      const parsed = new Date(body.due_date)
      if (isNaN(parsed.getTime())) errors.due_date = 'Due date must be a valid date.'
    }

    if (Object.keys(errors).length > 0) {
      return MantiqResponse.json({ errors }, 422)
    }

    if (body.title !== undefined) task.setAttribute('title', body.title.trim())
    if (body.description !== undefined) task.setAttribute('description', body.description?.trim() ?? null)
    if (body.priority !== undefined) task.setAttribute('priority', body.priority)
    if (body.due_date !== undefined) task.setAttribute('due_date', body.due_date)

    await task.save()

    return MantiqResponse.json({ data: task.toObject() })
  }

  // ── DELETE /api/tasks/:id ─────────────────────────────────────────────────
  async destroy(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const id = Number(request.param('id'))
    const task = await Task.find(id)
    if (!task) return MantiqResponse.json({ error: 'Task not found.' }, 404)

    // Authorization: must be reporter or admin
    const reporterId = task.getAttribute('reporter_id') as number
    if (reporterId !== authUser.getAuthIdentifier() && !authUser.isAdmin()) {
      return MantiqResponse.json({ error: 'Only the reporter or an admin can delete this task.' }, 403)
    }

    // Delete associated task_labels
    const pivots = await TaskLabel.where('task_id', id).get() as any[]
    for (const pivot of pivots) await pivot.delete()

    await task.delete()

    return MantiqResponse.json({ message: 'Task deleted successfully.' })
  }

  // ── PATCH /api/tasks/:id/assign ───────────────────────────────────────────
  async assign(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const id = Number(request.param('id'))
    const task = await Task.find(id)
    if (!task) return MantiqResponse.json({ error: 'Task not found.' }, 404)

    const body = await request.input() as { assignee_id?: number | null }

    if (body.assignee_id !== undefined && body.assignee_id !== null) {
      const assignee = await User.find(Number(body.assignee_id))
      if (!assignee) {
        return MantiqResponse.json({ errors: { assignee_id: 'User not found.' } }, 422)
      }
      task.setAttribute('assignee_id', Number(body.assignee_id))
    } else {
      // Unassign
      task.setAttribute('assignee_id', null)
    }

    await task.save()

    return MantiqResponse.json({
      data: task.toObject(),
      message: body.assignee_id ? 'Task assigned.' : 'Task unassigned.',
    })
  }

  // ── PATCH /api/tasks/:id/move ─────────────────────────────────────────────
  async move(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const id = Number(request.param('id'))
    const task = await Task.find(id)
    if (!task) return MantiqResponse.json({ error: 'Task not found.' }, 404)

    const body = await request.input() as { status?: string }

    if (!body.status) {
      return MantiqResponse.json({ errors: { status: 'Status is required.' } }, 422)
    }

    if (!(Task.VALID_STATUSES as readonly string[]).includes(body.status)) {
      return MantiqResponse.json({
        errors: { status: `Status must be one of: ${Task.VALID_STATUSES.join(', ')}.` },
      }, 422)
    }

    // Validate transition (admins can bypass transition rules)
    const currentStatus = task.getAttribute('status') as string
    if (currentStatus === body.status) {
      return MantiqResponse.json({ data: task.toObject(), message: 'No change.' })
    }

    const allowed = Task.TRANSITIONS[currentStatus]
    if (!authUser.isAdmin() && (!allowed || !allowed.includes(body.status))) {
      return MantiqResponse.json({
        errors: { status: `Cannot transition from '${currentStatus}' to '${body.status}'. Allowed: ${(allowed ?? []).join(', ') || 'none'}.` },
      }, 422)
    }

    task.setAttribute('status', body.status)

    // Auto-set completed_at
    if (body.status === 'done') {
      task.setAttribute('completed_at', new Date().toISOString())
    } else {
      task.setAttribute('completed_at', null)
    }

    await task.save()

    return MantiqResponse.json({
      data: task.toObject(),
      message: `Task moved to '${body.status}'.`,
    })
  }

  // ── PATCH /api/tasks/:id/reorder ──────────────────────────────────────────
  async reorder(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const authUser = await manager.user() as User | null
    if (!authUser) return MantiqResponse.json({ error: 'Unauthenticated.' }, 401)

    const id = Number(request.param('id'))
    const task = await Task.find(id)
    if (!task) return MantiqResponse.json({ error: 'Task not found.' }, 404)

    const body = await request.input() as { position?: number }

    if (body.position === undefined || body.position === null) {
      return MantiqResponse.json({ errors: { position: 'Position is required.' } }, 422)
    }

    const newPosition = Number(body.position)
    if (!Number.isInteger(newPosition) || newPosition < 0) {
      return MantiqResponse.json({ errors: { position: 'Position must be a non-negative integer.' } }, 422)
    }

    task.setAttribute('position', newPosition)
    await task.save()

    return MantiqResponse.json({
      data: task.toObject(),
      message: `Task reordered to position ${newPosition}.`,
    })
  }
}
