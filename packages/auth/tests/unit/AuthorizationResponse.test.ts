import { describe, test, expect } from 'bun:test'
import { AuthorizationResponse } from '../../src/authorization/AuthorizationResponse.ts'

describe('AuthorizationResponse', () => {
  test('constructor creates an allowed response', () => {
    const response = new AuthorizationResponse(true, 'Granted')
    expect(response.allowed()).toBe(true)
    expect(response.denied()).toBe(false)
    expect(response.message()).toBe('Granted')
  })

  test('constructor creates a denied response', () => {
    const response = new AuthorizationResponse(false, 'Nope', 403)
    expect(response.allowed()).toBe(false)
    expect(response.denied()).toBe(true)
    expect(response.message()).toBe('Nope')
    expect(response.code()).toBe(403)
  })

  test('constructor defaults message and code to null', () => {
    const response = new AuthorizationResponse(true)
    expect(response.message()).toBeNull()
    expect(response.code()).toBeNull()
  })

  test('allow() creates an allowed response', () => {
    const response = AuthorizationResponse.allow()
    expect(response.allowed()).toBe(true)
    expect(response.denied()).toBe(false)
    expect(response.message()).toBeNull()
  })

  test('allow() with custom message', () => {
    const response = AuthorizationResponse.allow('Access granted.')
    expect(response.allowed()).toBe(true)
    expect(response.message()).toBe('Access granted.')
  })

  test('deny() creates a denied response with defaults', () => {
    const response = AuthorizationResponse.deny()
    expect(response.allowed()).toBe(false)
    expect(response.denied()).toBe(true)
    expect(response.message()).toBe('This action is unauthorized.')
    expect(response.code()).toBe(403)
  })

  test('deny() with custom message and code', () => {
    const response = AuthorizationResponse.deny('Custom denial', 422)
    expect(response.allowed()).toBe(false)
    expect(response.message()).toBe('Custom denial')
    expect(response.code()).toBe(422)
  })

  test('deny() with only message uses default code', () => {
    const response = AuthorizationResponse.deny('No way')
    expect(response.message()).toBe('No way')
    expect(response.code()).toBe(403)
  })
})
