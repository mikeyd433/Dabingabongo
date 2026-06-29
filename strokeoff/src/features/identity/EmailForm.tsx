import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { FormMessage } from '@/components/FormMessage'
import { errorMessage, validateEmail } from '@/lib/validation'

interface EmailFormProps {
  label: string
  submitLabel: string
  /** Shown after a successful submit (e.g. "Check your email"). */
  successMessage: string
  onSubmit: (email: string) => Promise<void>
}

/** Shared email-entry form for magic-link sign-in, upgrade, and change-email. */
export function EmailForm({
  label,
  submitLabel,
  successMessage,
  onSubmit,
}: EmailFormProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validationError = validateEmail(email)
    if (validationError) {
      setError(validationError)
      return
    }
    setPending(true)
    setError(null)
    try {
      await onSubmit(email.trim())
      setDone(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return <FormMessage tone="success">{successMessage}</FormMessage>
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label className="font-label text-sm text-text" htmlFor="email">
        {label}
      </label>
      <TextInput
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
        disabled={pending}
      />
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button
        type="submit"
        variant="secondary"
        disabled={pending}
        className="mt-1"
      >
        {pending ? 'Sending…' : submitLabel}
      </Button>
    </form>
  )
}
