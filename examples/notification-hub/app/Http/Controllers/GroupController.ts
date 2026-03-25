import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { NotificationGroup } from '../../Models/NotificationGroup.ts'
import { NotificationLog } from '../../Models/NotificationLog.ts'
import { NotificationTemplate } from '../../Models/NotificationTemplate.ts'
import { User } from '../../Models/User.ts'

function renderTemplate(text: string, variables: Record<string, string>): string {
  let rendered = text
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return rendered
}

export class GroupController {
  /**
   * List all notification groups.
   */
  async index(_request: MantiqRequest): Promise<Response> {
    const groups = await NotificationGroup.query()
      .orderBy('created_at', 'desc')
      .get() as any[]

    const data = groups.map((g: any) => {
      const obj = g.toObject()
      try {
        obj.members = JSON.parse(obj.members)
      } catch { /* leave as-is */ }
      return obj
    })

    return MantiqResponse.json({ data })
  }

  /**
   * Create a new notification group.
   */
  async store(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const body = await request.input() as {
      name?: string
      description?: string
      members?: number[]
    }

    // ── Validation ──────────────────────────────────────────────────────────
    const errors: Record<string, string> = {}

    if (!body.name || !body.name.trim()) {
      errors.name = 'Name is required.'
    }

    if (Object.keys(errors).length > 0) {
      return MantiqResponse.json({ message: 'Validation failed.', errors }, 422)
    }

    const group = await NotificationGroup.create({
      name: body.name!.trim(),
      description: body.description?.trim() || null,
      user_id: user.getAuthIdentifier(),
      members: JSON.stringify(body.members ?? []),
    })

    const obj = group.toObject()
    try { obj.members = JSON.parse(obj.members) } catch { /* leave as-is */ }

    return MantiqResponse.json({ message: 'Group created.', data: obj }, 201)
  }

  /**
   * Add user IDs to a group's members.
   */
  async addMembers(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const group = await NotificationGroup.find(Number(id))

    if (!group) {
      return MantiqResponse.json({ message: 'Group not found.' }, 404)
    }

    const body = await request.input() as { user_ids?: number[] }

    if (!body.user_ids || !Array.isArray(body.user_ids) || body.user_ids.length === 0) {
      return MantiqResponse.json({
        message: 'Validation failed.',
        errors: { user_ids: 'At least one user ID is required.' },
      }, 422)
    }

    let members: number[] = []
    try {
      members = JSON.parse(group.getAttribute('members') as string)
    } catch { /* start fresh */ }

    // Add new members (avoid duplicates)
    for (const uid of body.user_ids) {
      if (!members.includes(uid)) {
        members.push(uid)
      }
    }

    group.setAttribute('members', JSON.stringify(members))
    await group.save()

    const obj = group.toObject()
    obj.members = members

    return MantiqResponse.json({ message: 'Members added.', data: obj })
  }

  /**
   * Remove user IDs from a group's members.
   */
  async removeMembers(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const group = await NotificationGroup.find(Number(id))

    if (!group) {
      return MantiqResponse.json({ message: 'Group not found.' }, 404)
    }

    const body = await request.input() as { user_ids?: number[] }

    if (!body.user_ids || !Array.isArray(body.user_ids) || body.user_ids.length === 0) {
      return MantiqResponse.json({
        message: 'Validation failed.',
        errors: { user_ids: 'At least one user ID is required.' },
      }, 422)
    }

    let members: number[] = []
    try {
      members = JSON.parse(group.getAttribute('members') as string)
    } catch { /* start fresh */ }

    members = members.filter(uid => !body.user_ids!.includes(uid))

    group.setAttribute('members', JSON.stringify(members))
    await group.save()

    const obj = group.toObject()
    obj.members = members

    return MantiqResponse.json({ message: 'Members removed.', data: obj })
  }

  /**
   * Send a notification to all group members.
   */
  async notify(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const id = request.param('id')
    const group = await NotificationGroup.find(Number(id))

    if (!group) {
      return MantiqResponse.json({ message: 'Group not found.' }, 404)
    }

    const body = await request.input() as {
      template_id?: number
      channel?: string
      subject?: string
      body?: string
      variables?: Record<string, string>
    }

    if (!body.template_id && !body.body) {
      return MantiqResponse.json({
        message: 'Validation failed.',
        errors: { body: 'Either template_id or body is required.' },
      }, 422)
    }

    const variables = body.variables ?? {}
    let channel = body.channel ?? ''
    let subject = body.subject ?? ''
    let notifBody = body.body ?? ''

    if (body.template_id) {
      const template = await NotificationTemplate.find(Number(body.template_id))
      if (!template) {
        return MantiqResponse.json({ message: 'Template not found.' }, 404)
      }
      channel = template.getAttribute('channel') as string
      subject = renderTemplate((template.getAttribute('subject') as string) ?? '', variables)
      notifBody = renderTemplate(template.getAttribute('body') as string, variables)
    } else {
      subject = renderTemplate(subject, variables)
      notifBody = renderTemplate(notifBody, variables)
    }

    let members: number[] = []
    try {
      members = JSON.parse(group.getAttribute('members') as string)
    } catch { /* empty */ }

    const logs: any[] = []

    for (const memberId of members) {
      const memberUser = await User.find(memberId)
      if (!memberUser) continue

      const recipient = memberUser.getAttribute('email') as string

      const log = await NotificationLog.create({
        user_id: memberId,
        template_id: body.template_id ?? null,
        channel,
        recipient,
        subject,
        body: notifBody,
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: JSON.stringify({ group_id: Number(id), variables }),
      })

      logs.push(log.toObject())
    }

    return MantiqResponse.json({
      message: `Notification sent to ${logs.length} group member(s).`,
      data: logs,
    })
  }
}
