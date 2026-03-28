import { describe, test, expect } from 'bun:test'
import { ErrorCodes } from '../../src/errors/ErrorCodes.ts'
import { MantiqError } from '../../src/errors/MantiqError.ts'
import { HttpError } from '../../src/errors/HttpError.ts'
import { NotFoundError } from '../../src/errors/NotFoundError.ts'
import { UnauthorizedError } from '../../src/errors/UnauthorizedError.ts'
import { ForbiddenError } from '../../src/errors/ForbiddenError.ts'
import { ValidationError } from '../../src/errors/ValidationError.ts'
import { TooManyRequestsError } from '../../src/errors/TooManyRequestsError.ts'
import { ContainerResolutionError } from '../../src/errors/ContainerResolutionError.ts'
import { ConfigKeyNotFoundError } from '../../src/errors/ConfigKeyNotFoundError.ts'
import { TokenMismatchError } from '../../src/errors/TokenMismatchError.ts'
import { EncryptionError, DecryptionError, MissingAppKeyError } from '../../src/encryption/errors.ts'

describe('ErrorCodes', () => {
  test('all error codes follow E_ prefix convention', () => {
    for (const [_key, value] of Object.entries(ErrorCodes)) {
      expect(value).toMatch(/^E_/)
    }
  })

  test('all error codes are unique', () => {
    const values = Object.values(ErrorCodes)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })
})

describe('Error classes include errorCode', () => {
  test('MantiqError accepts and stores errorCode', () => {
    const err = new MantiqError('test', undefined, ErrorCodes.HTTP_ERROR)
    expect(err.errorCode).toBe('E_HTTP_ERROR')
  })

  test('MantiqError.errorCode is undefined when not provided', () => {
    const err = new MantiqError('test')
    expect(err.errorCode).toBeUndefined()
  })

  test('HttpError has HTTP_ERROR code by default', () => {
    const err = new HttpError(500, 'Internal Server Error')
    expect(err.errorCode).toBe(ErrorCodes.HTTP_ERROR)
  })

  test('NotFoundError has ROUTE_NOT_FOUND code', () => {
    const err = new NotFoundError()
    expect(err.errorCode).toBe(ErrorCodes.ROUTE_NOT_FOUND)
  })

  test('UnauthorizedError has AUTH_UNAUTHENTICATED code', () => {
    const err = new UnauthorizedError()
    expect(err.errorCode).toBe(ErrorCodes.AUTH_UNAUTHENTICATED)
  })

  test('ForbiddenError has AUTH_FORBIDDEN code', () => {
    const err = new ForbiddenError()
    expect(err.errorCode).toBe(ErrorCodes.AUTH_FORBIDDEN)
  })

  test('ValidationError has VALIDATION_FAILED code', () => {
    const err = new ValidationError({ email: ['required'] })
    expect(err.errorCode).toBe(ErrorCodes.VALIDATION_FAILED)
  })

  test('TooManyRequestsError has RATE_LIMITED code', () => {
    const err = new TooManyRequestsError()
    expect(err.errorCode).toBe(ErrorCodes.RATE_LIMITED)
  })

  test('ContainerResolutionError has CONTAINER_RESOLUTION code', () => {
    const err = new ContainerResolutionError('Service', 'not_bound')
    expect(err.errorCode).toBe(ErrorCodes.CONTAINER_RESOLUTION)
  })

  test('ConfigKeyNotFoundError has CONFIG_NOT_FOUND code', () => {
    const err = new ConfigKeyNotFoundError('app.name')
    expect(err.errorCode).toBe(ErrorCodes.CONFIG_NOT_FOUND)
  })

  test('TokenMismatchError has CSRF_MISMATCH code', () => {
    const err = new TokenMismatchError()
    expect(err.errorCode).toBe(ErrorCodes.CSRF_MISMATCH)
  })

  test('EncryptionError has ENCRYPTION_FAILED code', () => {
    const err = new EncryptionError()
    expect(err.errorCode).toBe(ErrorCodes.ENCRYPTION_FAILED)
  })

  test('DecryptionError has DECRYPTION_FAILED code', () => {
    const err = new DecryptionError()
    expect(err.errorCode).toBe(ErrorCodes.DECRYPTION_FAILED)
  })

  test('MissingAppKeyError has MISSING_APP_KEY code', () => {
    const err = new MissingAppKeyError()
    expect(err.errorCode).toBe(ErrorCodes.MISSING_APP_KEY)
  })
})

describe('Error inheritance', () => {
  test('all errors are instances of Error', () => {
    expect(new MantiqError('test')).toBeInstanceOf(Error)
    expect(new HttpError(500, 'test')).toBeInstanceOf(Error)
    expect(new NotFoundError()).toBeInstanceOf(Error)
  })

  test('HttpError subclasses are instances of MantiqError', () => {
    expect(new NotFoundError()).toBeInstanceOf(MantiqError)
    expect(new UnauthorizedError()).toBeInstanceOf(MantiqError)
    expect(new ValidationError({})).toBeInstanceOf(MantiqError)
    expect(new TokenMismatchError()).toBeInstanceOf(MantiqError)
  })
})
