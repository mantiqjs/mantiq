import { Seeder } from '@mantiq/database'
import { HashManager } from '@mantiq/core'
import { User } from '../../app/Models/User.ts'
import { Project } from '../../app/Models/Project.ts'
import { Task } from '../../app/Models/Task.ts'
import { Label } from '../../app/Models/Label.ts'
import { TaskLabel } from '../../app/Models/TaskLabel.ts'

export default class DatabaseSeeder extends Seeder {
  override async run() {
    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const hashed = await hasher.make('password')

    // ── Users ─────────────────────────────────────────────────────────────
    const adminExists = await User.where('email', 'admin@example.com').first()
    if (adminExists) return // Already seeded

    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashed,
      role: 'admin',
    })

    const manager = await User.create({
      name: 'Project Manager',
      email: 'manager@example.com',
      password: hashed,
      role: 'manager',
    })

    const developer = await User.create({
      name: 'Developer',
      email: 'developer@example.com',
      password: hashed,
      role: 'member',
    })

    const adminId = admin.getAttribute('id') as number
    const managerId = manager.getAttribute('id') as number
    const devId = developer.getAttribute('id') as number

    // ── Projects ──────────────────────────────────────────────────────────
    const backendProject = await Project.create({
      name: 'Backend API',
      description: 'Core REST API for the platform, handling authentication, data processing, and integrations.',
      user_id: managerId,
      status: 'active',
      color: '#6366f1',
    })

    const mobileProject = await Project.create({
      name: 'Mobile App',
      description: 'Cross-platform mobile application built with React Native.',
      user_id: managerId,
      status: 'active',
      color: '#10b981',
    })

    const marketingProject = await Project.create({
      name: 'Marketing Website',
      description: 'Public-facing marketing website with CMS integration and analytics.',
      user_id: adminId,
      status: 'active',
      color: '#f59e0b',
    })

    const backendId = backendProject.getAttribute('id') as number
    const mobileId = mobileProject.getAttribute('id') as number
    const marketingId = marketingProject.getAttribute('id') as number

    // ── Labels (5 per project) ────────────────────────────────────────────
    const labelDefs = [
      { name: 'Bug', color: '#ef4444' },
      { name: 'Feature', color: '#3b82f6' },
      { name: 'Enhancement', color: '#8b5cf6' },
      { name: 'Documentation', color: '#6b7280' },
      { name: 'Urgent', color: '#f97316' },
    ]

    const labelsByProject: Record<number, any[]> = {}
    for (const projectId of [backendId, mobileId, marketingId]) {
      labelsByProject[projectId] = []
      for (const def of labelDefs) {
        const label = await Label.create({
          name: def.name,
          color: def.color,
          project_id: projectId,
        })
        labelsByProject[projectId]!.push(label)
      }
    }

    // ── Tasks ─────────────────────────────────────────────────────────────
    const taskDefs = [
      // Backend API (6 tasks)
      {
        title: 'Set up authentication middleware', description: 'Implement JWT-based authentication with refresh token rotation.',
        project_id: backendId, assignee_id: devId, reporter_id: managerId,
        status: 'done', priority: 'high', position: 1,
        labels: ['Feature'],
      },
      {
        title: 'Design database schema', description: 'Create ERD and implement migrations for all core entities.',
        project_id: backendId, assignee_id: devId, reporter_id: managerId,
        status: 'done', priority: 'high', position: 2,
        labels: ['Feature'],
      },
      {
        title: 'Implement rate limiting', description: 'Add rate limiting middleware to prevent API abuse.',
        project_id: backendId, assignee_id: devId, reporter_id: managerId,
        status: 'in_progress', priority: 'medium', position: 3,
        labels: ['Enhancement'],
      },
      {
        title: 'Fix N+1 query in user listing', description: 'User listing endpoint performs excessive database queries.',
        project_id: backendId, assignee_id: devId, reporter_id: adminId,
        status: 'in_review', priority: 'high', position: 4,
        labels: ['Bug'],
      },
      {
        title: 'Write API documentation', description: 'Document all endpoints using OpenAPI 3.0 specification.',
        project_id: backendId, assignee_id: null, reporter_id: managerId,
        status: 'todo', priority: 'medium', position: 5,
        labels: ['Documentation'],
      },
      {
        title: 'Add WebSocket support for real-time notifications', description: 'Implement WebSocket server for push notifications.',
        project_id: backendId, assignee_id: null, reporter_id: managerId,
        status: 'todo', priority: 'low', position: 6,
        labels: ['Feature'],
      },

      // Mobile App (5 tasks)
      {
        title: 'Set up React Native project', description: 'Initialize project with TypeScript, navigation, and state management.',
        project_id: mobileId, assignee_id: devId, reporter_id: managerId,
        status: 'done', priority: 'high', position: 1,
        labels: ['Feature'],
      },
      {
        title: 'Build login screen', description: 'Create login UI with email/password and social auth options.',
        project_id: mobileId, assignee_id: devId, reporter_id: managerId,
        status: 'in_progress', priority: 'high', position: 2,
        labels: ['Feature'],
      },
      {
        title: 'Fix crash on Android 12', description: 'App crashes on launch for Android 12 devices due to splash screen API changes.',
        project_id: mobileId, assignee_id: devId, reporter_id: adminId,
        status: 'todo', priority: 'critical', position: 3,
        labels: ['Bug', 'Urgent'],
      },
      {
        title: 'Implement offline data sync', description: 'Allow users to work offline with automatic sync when connection is restored.',
        project_id: mobileId, assignee_id: null, reporter_id: managerId,
        status: 'todo', priority: 'medium', position: 4,
        labels: ['Feature'],
      },
      {
        title: 'Add push notification support', description: 'Integrate Firebase Cloud Messaging for push notifications.',
        project_id: mobileId, assignee_id: null, reporter_id: managerId,
        status: 'todo', priority: 'low', position: 5,
        labels: ['Feature'],
      },

      // Marketing Website (4 tasks)
      {
        title: 'Design landing page', description: 'Create responsive hero section with CTAs and feature highlights.',
        project_id: marketingId, assignee_id: devId, reporter_id: adminId,
        status: 'in_progress', priority: 'high', position: 1,
        labels: ['Feature'],
      },
      {
        title: 'Set up analytics tracking', description: 'Integrate Google Analytics 4 and custom event tracking.',
        project_id: marketingId, assignee_id: null, reporter_id: adminId,
        status: 'todo', priority: 'medium', position: 2,
        labels: ['Enhancement'],
      },
      {
        title: 'Fix broken links in footer', description: 'Several footer links point to non-existent pages.',
        project_id: marketingId, assignee_id: devId, reporter_id: adminId,
        status: 'in_review', priority: 'low', position: 3,
        labels: ['Bug'],
      },
      {
        title: 'Write SEO meta descriptions', description: 'Add unique meta descriptions for all pages to improve search ranking.',
        project_id: marketingId, assignee_id: null, reporter_id: adminId,
        status: 'todo', priority: 'medium', position: 4,
        labels: ['Documentation'],
      },
    ]

    for (const def of taskDefs) {
      const { labels: labelNames, ...taskData } = def
      const completedAt = taskData.status === 'done' ? new Date().toISOString() : null

      const task = await Task.create({
        ...taskData,
        due_date: null,
        completed_at: completedAt,
      })

      // Attach labels
      const taskId = task.getAttribute('id') as number
      const projectLabels = labelsByProject[taskData.project_id] ?? []
      for (const labelName of labelNames) {
        const label = projectLabels.find((l: any) => l.getAttribute('name') === labelName)
        if (label) {
          await TaskLabel.create({
            task_id: taskId,
            label_id: label.getAttribute('id') as number,
          })
        }
      }
    }
  }
}
