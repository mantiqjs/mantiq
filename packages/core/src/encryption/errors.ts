import { MantiqError } from '../errors/MantiqError.ts'
import { ErrorCodes } from '../errors/ErrorCodes.ts'

/**
 * Thrown when encryption fails (e.g. invalid key, algorithm error).
 */
export class EncryptionError extends MantiqError {
  constructor(message = 'Could not encrypt the data.', context?: Record<string, any>) {
    super(message, context, ErrorCodes.ENCRYPTION_FAILED)
  }
}

/**
 * Thrown when decryption fails (e.g. tampered payload, wrong key).
 */
export class DecryptionError extends MantiqError {
  constructor(message = 'Could not decrypt the data.', context?: Record<string, any>) {
    super(message, context, ErrorCodes.DECRYPTION_FAILED)
  }
}

/**
 * Thrown when APP_KEY is missing or invalid.
 */
export class MissingAppKeyError extends MantiqError {
  constructor() {
    super(
      'No application encryption key has been specified. Set the APP_KEY environment variable (use "base64:<key>" format for raw keys).',
      undefined,
      ErrorCodes.MISSING_APP_KEY,
    )
  }
}
