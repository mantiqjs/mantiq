import { Seeder } from '@mantiq/database'
import { HashManager } from '@mantiq/core'
import { User } from '../../app/Models/User.ts'

export default class DatabaseSeeder extends Seeder {
  override async run() {
    const hasher = new HashManager({ bcrypt: { rounds: 10 } })

    // Admin user
    const existing = await User.where('email', 'admin@example.com').first()
    if (!existing) {
      await User.create({
        name: 'Admin',
        email: 'admin@example.com',
        password: await hasher.make('password'),
      })
    }

    // 50 sample users
    const names = [
      'Olivia Martin', 'Jackson Lee', 'Isabella Nguyen', 'William Kim', 'Sofia Davis',
      'Liam Johnson', 'Emma Wilson', 'Noah Brown', 'Ava Garcia', 'Ethan Martinez',
      'Mia Rodriguez', 'James Anderson', 'Charlotte Thomas', 'Benjamin Taylor', 'Amelia Hernandez',
      'Lucas Moore', 'Harper Jackson', 'Alexander White', 'Evelyn Harris', 'Daniel Clark',
      'Abigail Lewis', 'Henry Robinson', 'Emily Walker', 'Sebastian Hall', 'Ella Young',
      'Owen King', 'Scarlett Wright', 'Jack Scott', 'Grace Green', 'Samuel Adams',
      'Chloe Baker', 'Ryan Nelson', 'Lily Hill', 'Nathan Ramirez', 'Zoey Campbell',
      'Caleb Mitchell', 'Hannah Roberts', 'Dylan Carter', 'Aria Phillips', 'Luke Evans',
      'Penelope Turner', 'Gabriel Torres', 'Layla Parker', 'Matthew Collins', 'Riley Edwards',
      'David Stewart', 'Nora Sanchez', 'Joseph Morris', 'Stella Rogers', 'Andrew Reed',
    ]

    const hashed = await hasher.make('password')
    for (const name of names) {
      const email = name.toLowerCase().replace(' ', '.') + '@example.com'
      const exists = await User.where('email', email).first()
      if (!exists) {
        await User.create({ name, email, password: hashed })
      }
    }
  }
}
