import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { FormMessage } from '@/components/FormMessage'
import { errorMessage, validateDisplayName } from '@/lib/validation'

interface DisplayNameFormProps {
  initial?: string
  submitLabel: string
  /** Resolve to commit; throw to surface an error. */
  onSubmit: (name: string) => Promise<void>
}

/** Shared display-name entry used by first-run and the Me section (spec §4). */
export function DisplayNameForm({
  initial = '',
  submitLabel,
  onSubmit,
}: DisplayNameFormProps) {
  const [name, setName] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validationError = validateDisplayName(name)
    if (validationError) {
      setError(validationError)
      return
    }
    setPending(true)
    setError(null)
    try {
      await onSubmit(name.trim())
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label className="font-label text-sm text-text" htmlFor="display-name">
        Display name
      </label>
      <TextInput
        id="display-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Jordan"
        autoComplete="nickname"
        disabled={pending}
      />
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? 'Working…' : submitLabel}
      </Button>
    </form>
  )
}
