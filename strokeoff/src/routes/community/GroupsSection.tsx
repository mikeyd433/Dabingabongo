import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { FormMessage } from '@/components/FormMessage'
import { GroupCard } from '@/features/groups/GroupCard'
import { useAuth } from '@/lib/auth'
import { useMyGroups } from '@/lib/profile'
import { useCreateGroup, useJoinGroup } from '@/lib/groups'
import { errorMessage, validateDisplayName } from '@/lib/validation'

/**
 * Community → Groups (spec §11). Create a group, join via invite code, and manage
 * each group (invite, members, conversion, leave). Quick-add from People is wired
 * through the player profile (Phase 11). Group membership is login-only.
 */
export function GroupsSection() {
  const { user, isAnonymous } = useAuth()
  const { data: groups, isLoading } = useMyGroups()

  if (!user || isAnonymous) {
    return (
      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="font-display text-base font-semibold text-text">
          Groups
        </h2>
        <p className="mt-2 font-label text-sm text-muted">
          Groups hold a shared rule library, default conversion, and house
          theme. Sign in to create or join one — group membership is login-only.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-card border border-border bg-surface p-4">
        <h2 className="font-display text-base font-semibold text-text">
          Groups
        </h2>
        <div className="mt-3 flex flex-col gap-4">
          <CreateGroupForm />
          <hr className="border-border" />
          <JoinGroupForm />
        </div>
      </div>

      {isLoading ? (
        <p className="px-1 font-label text-sm text-muted">Loading groups…</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {(groups ?? []).map((group) => (
            <GroupCard key={group.id} group={group} currentUserId={user.id} />
          ))}
        </ul>
      )}
    </section>
  )
}

function CreateGroupForm() {
  const createGroup = useCreateGroup()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validationError = validateDisplayName(name)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    try {
      await createGroup.mutateAsync(name.trim())
      setName('')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="group-name" className="font-label text-sm text-text">
        Create a group
      </label>
      <div className="flex gap-2">
        <TextInput
          id="group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Weekend crew"
        />
        <Button type="submit" disabled={createGroup.isPending}>
          {createGroup.isPending ? 'Creating…' : 'Create'}
        </Button>
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </form>
  )
}

function JoinGroupForm() {
  const [searchParams, setSearchParams] = useSearchParams()
  const joinGroup = useJoinGroup()
  const [code, setCode] = useState(searchParams.get('join') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (code.trim().length === 0) {
      setError('Enter an invite code.')
      return
    }
    setError(null)
    try {
      const group = await joinGroup.mutateAsync(code.trim())
      setJoined(group.name)
      setCode('')
      if (searchParams.has('join')) {
        searchParams.delete('join')
        setSearchParams(searchParams, { replace: true })
      }
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="join-code" className="font-label text-sm text-text">
        Join a group
      </label>
      <div className="flex gap-2">
        <TextInput
          id="join-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Invite code"
          autoCapitalize="characters"
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={joinGroup.isPending}
        >
          {joinGroup.isPending ? 'Joining…' : 'Join'}
        </Button>
      </div>
      {joined ? (
        <FormMessage tone="success">Joined {joined}.</FormMessage>
      ) : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </form>
  )
}
