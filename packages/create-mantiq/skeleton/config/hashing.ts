import { env } from '@mantiq/core'

export default {
  // Default hashing driver: 'bcrypt' | 'argon2'
  driver: env('HASH_DRIVER', 'bcrypt'),

  bcrypt: {
    // Cost factor — higher is slower but more secure (10-12 recommended)
    rounds: Number(env('BCRYPT_ROUNDS', '10')),
  },

  argon2: {
    memory: 65536,   // Memory cost in KiB
    time: 4,         // Number of iterations
    parallelism: 1,  // Degree of parallelism
  },
}
