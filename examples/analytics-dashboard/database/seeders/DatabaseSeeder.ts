import { Seeder } from '@mantiq/database'
import { HashManager } from '@mantiq/core'
import { User } from '../../app/Models/User.ts'
import { Metric } from '../../app/Models/Metric.ts'
import { Alert } from '../../app/Models/Alert.ts'
import { Dashboard } from '../../app/Models/Dashboard.ts'

export default class DatabaseSeeder extends Seeder {
  override async run() {
    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const hashed = await hasher.make('password')

    // Users
    const existingAdmin = await User.where('email', 'admin@example.com').first()
    if (existingAdmin) return

    await User.create({ name: 'Admin', email: 'admin@example.com', password: hashed, role: 'admin' })
    await User.create({ name: 'Viewer', email: 'viewer@example.com', password: hashed, role: 'viewer' })

    // Metrics — generate 100 sample data points over the last 24 hours
    const metricDefs = [
      { name: 'cpu_usage', unit: '%', min: 20, max: 95 },
      { name: 'memory_usage', unit: '%', min: 30, max: 85 },
      { name: 'request_latency', unit: 'ms', min: 50, max: 2000 },
      { name: 'error_rate', unit: '%', min: 0, max: 12 },
      { name: 'disk_usage', unit: '%', min: 40, max: 75 },
    ]

    const now = Date.now()
    for (let i = 0; i < 100; i++) {
      const def = metricDefs[i % metricDefs.length]!
      const value = Math.round((def.min + Math.random() * (def.max - def.min)) * 100) / 100
      const offsetMs = Math.floor(Math.random() * 86400000) // random offset within 24h
      const recorded = new Date(now - offsetMs).toISOString()

      await Metric.create({
        name: def.name,
        value,
        unit: def.unit,
        tags: JSON.stringify({ host: `server-${(i % 3) + 1}`, region: i % 2 === 0 ? 'us-east' : 'eu-west' }),
        recorded_at: recorded,
      })
    }

    // Alerts
    await Alert.create({
      name: 'High CPU Usage', metric_name: 'cpu_usage', condition: 'gt', threshold: 90,
      window_seconds: 300, channel: 'log', channel_target: null, is_active: 1,
      last_triggered_at: null, cooldown_seconds: 600,
    })
    await Alert.create({
      name: 'High Error Rate', metric_name: 'error_rate', condition: 'gt', threshold: 5,
      window_seconds: 300, channel: 'mail', channel_target: 'admin@example.com', is_active: 1,
      last_triggered_at: null, cooldown_seconds: 600,
    })
    await Alert.create({
      name: 'Slow Requests', metric_name: 'request_latency', condition: 'gt', threshold: 1000,
      window_seconds: 600, channel: 'webhook', channel_target: 'https://hooks.example.com/alerts', is_active: 1,
      last_triggered_at: null, cooldown_seconds: 300,
    })

    // Dashboard
    await Dashboard.create({
      name: 'Operations Overview',
      description: 'Main operations dashboard with system health metrics',
      user_id: 1,
      layout: JSON.stringify([
        { type: 'timeseries', metric: 'cpu_usage', title: 'CPU Usage', position: { x: 0, y: 0, w: 6, h: 4 } },
        { type: 'timeseries', metric: 'memory_usage', title: 'Memory Usage', position: { x: 6, y: 0, w: 6, h: 4 } },
        { type: 'gauge', metric: 'error_rate', title: 'Error Rate', position: { x: 0, y: 4, w: 4, h: 3 } },
        { type: 'timeseries', metric: 'request_latency', title: 'Request Latency', position: { x: 4, y: 4, w: 8, h: 3 } },
      ]),
      is_public: 1,
    })
  }
}
