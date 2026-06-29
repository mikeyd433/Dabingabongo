/**
 * Pure input validators for identity forms. Kept free of React/Supabase so they're
 * trivially unit-testable and reusable across screens.
 */

export const DISPLAY_NAME_MAX = 40
export const CUSTOM_MESSAGE_MAX = 140

/** Returns an error message, or null when the display name is valid. */
export function validateDisplayName(raw: string): string | null {
  const value = raw.trim()
  if (value.length === 0) return 'Enter a display name.'
  if (value.length > DISPLAY_NAME_MAX) {
    return `Keep it under ${DISPLAY_NAME_MAX} characters.`
  }
  return null
}

/** Returns an error message, or null when the email looks valid. */
export function validateEmail(raw: string): string | null {
  const value = raw.trim()
  if (value.length === 0) return 'Enter an email address.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'Enter a valid email address.'
  }
  return null
}

/** Custom message is optional; only length-limited. */
export function validateCustomMessage(raw: string): string | null {
  if (raw.length > CUSTOM_MESSAGE_MAX) {
    return `Keep it under ${CUSTOM_MESSAGE_MAX} characters.`
  }
  return null
}

/** Normalize an unknown thrown value to a user-facing string. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Something went wrong. Try again.'
}
