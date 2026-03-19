import { Seeder, db } from '@mantiq/database'
import { HashManager } from '@mantiq/core'
import { UserFactory } from '../factories/UserFactory.ts'
import { User } from '../../app/Models/User.ts'

export default class MillionUserSeeder extends Seeder {
  override async run() {
    const count = await User.count()
    if (count >= 1_000_000) {
      console.log(`  Already have ${count.toLocaleString()} users, skipping.`)
      return
    }

    const target = 1_000_000 - count
    console.log(`  Seeding ${target.toLocaleString()} users...`)

    // Pre-hash a single password so we're not running bcrypt 1M times
    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const passwordHash = await hasher.make('password')

    const t0 = performance.now()

    const inserted = await new UserFactory()
      .count(target)
      .state({ password: passwordHash })
      .createBulk(db(), {
        batchSize: 1000,
        onProgress: (done, total) => {
          if (done % 100_000 === 0 || done === total) {
            const pct = ((done / total) * 100).toFixed(1)
            const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
            const rate = Math.round(done / ((performance.now() - t0) / 1000))
            console.log(`  ${done.toLocaleString()} / ${total.toLocaleString()} (${pct}%) — ${elapsed}s — ${rate.toLocaleString()}/s`)
          }
        },
      })

    const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
    console.log(`  Done: ${inserted.toLocaleString()} users in ${elapsed}s`)
  }
}
