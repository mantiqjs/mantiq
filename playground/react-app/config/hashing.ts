import { env } from '@mantiq/core'

export default {

  /*
  |--------------------------------------------------------------------------
  | Default Hash Driver
  |--------------------------------------------------------------------------
  |
  | This option controls the default hash driver used for hashing
  | passwords and other values. Bcrypt is the recommended default.
  |
  | Supported: 'bcrypt', 'argon2'
  |
  */
  driver: env('HASH_DRIVER', 'bcrypt'),

  /*
  |--------------------------------------------------------------------------
  | Bcrypt Options
  |--------------------------------------------------------------------------
  |
  | Here you may configure the round count used by the Bcrypt hashing
  | algorithm. Higher rounds increase security but also increase the
  | time required to hash a value (10-12 recommended).
  |
  */
  bcrypt: {
    rounds: Number(env('BCRYPT_ROUNDS', '10')),
  },

  /*
  |--------------------------------------------------------------------------
  | Argon2 Options
  |--------------------------------------------------------------------------
  |
  | Here you may configure the memory cost, time cost, and parallelism
  | used by the Argon2 hashing algorithm. These values control the
  | difficulty of producing a valid hash.
  |
  */
  argon2: {
    memory: 65536,   // Memory cost in KiB (64 MB)
    time: 4,         // Number of iterations
    parallelism: 1,  // Degree of parallelism
  },
}
