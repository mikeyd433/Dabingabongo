import { describe, expect, it } from 'vitest'
import {
  CUSTOM_MESSAGE_MAX,
  DISPLAY_NAME_MAX,
  errorMessage,
  validateCustomMessage,
  validateDisplayName,
  validateEmail,
} from './validation'

describe('validateDisplayName', () => {
  it('rejects empty / whitespace-only names', () => {
    expect(validateDisplayName('')).not.toBeNull()
    expect(validateDisplayName('   ')).not.toBeNull()
  })

  it('accepts a normal name', () => {
    expect(validateDisplayName('Jordan')).toBeNull()
  })

  it('rejects names over the limit', () => {
    expect(validateDisplayName('a'.repeat(DISPLAY_NAME_MAX + 1))).not.toBeNull()
    expect(validateDisplayName('a'.repeat(DISPLAY_NAME_MAX))).toBeNull()
  })
})

describe('validateEmail', () => {
  it('rejects malformed addresses', () => {
    expect(validateEmail('')).not.toBeNull()
    expect(validateEmail('nope')).not.toBeNull()
    expect(validateEmail('a@b')).not.toBeNull()
  })

  it('accepts a valid address', () => {
    expect(validateEmail('player@example.com')).toBeNull()
  })
})

describe('validateCustomMessage', () => {
  it('allows empty and short messages', () => {
    expect(validateCustomMessage('')).toBeNull()
    expect(validateCustomMessage('on a hot streak')).toBeNull()
  })

  it('rejects over-long messages', () => {
    expect(
      validateCustomMessage('x'.repeat(CUSTOM_MESSAGE_MAX + 1)),
    ).not.toBeNull()
  })
})

describe('errorMessage', () => {
  it('unwraps Error, string, and unknown values', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage('nope')).toBe('nope')
    expect(errorMessage(42)).toMatch(/something went wrong/i)
  })
})
