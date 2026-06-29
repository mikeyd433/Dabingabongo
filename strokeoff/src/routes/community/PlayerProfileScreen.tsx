import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { FormMessage } from '@/components/FormMessage'
import { useAuth } from '@/lib/auth'
import { useMyGroups } from '@/lib/profile'
import {
  usePerson,
  usePlayerRounds,
  usePlayerStats,
  useQuickAddToGroup,
} from '@/lib/people'
import { addableGroups, personSubtitle } from '@/features/people/people'
import { errorMessage } from '@/lib/validation'
import type { PersonSummary } from '@/types'

/**
 * A player's profile (Community → People; spec §11): avatar, message, shared
 * history, quick-add to one of your groups, and the rounds of theirs you're
 * allowed to see. Reached from the People list.
 */
export function PlayerProfileScreen() {
  const { profileId } = useParams<{ profileId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: person, isLoading } = usePerson(profileId)

  if (!user) {
    return (
      <div className="px-6 py-12 text-center font-label text-sm text-muted">
        Sign in to view players you've played with.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="px-6 py-12 text-center font-label text-sm text-muted">
        Loading profile…
      </div>
    )
  }

  if (!person) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
        <p className="font-label text-sm text-muted">
          We couldn't find that player among the people you've played with.
        </p>
        <Button variant="secondary" onClick={() => navigate('/community')}>
          Back to Community
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <button
        type="button"
        onClick={() => navigate('/community')}
        className="self-start font-label text-xs text-muted underline"
      >
        ← People
      </button>

      <header className="flex items-center gap-4 rounded-card border border-border bg-surface p-4">
        <Avatar
          name={person.display_name}
          url={person.avatar_url}
          sizeClass="h-16 w-16 text-xl"
        />
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-bold text-text">
            {person.display_name}
          </h1>
          {person.custom_message ? (
            <p className="mt-0.5 truncate font-label text-sm text-muted">
              {person.custom_message}
            </p>
          ) : null}
          <p className="mt-0.5 font-label text-xs text-muted">
            {personSubtitle(person)}
          </p>
        </div>
      </header>

      <QuickAddCard person={person} />

      <PlayerRoundsCard profileId={person.profile_id} />
    </div>
  )
}

function QuickAddCard({ person }: { person: PersonSummary }) {
  const { data: groups = [] } = useMyGroups()
  const quickAdd = useQuickAddToGroup()
  const options = addableGroups(person, groups)
  const [groupId, setGroupId] = useState('')
  const [added, setAdded] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (person.is_anonymous) {
    return (
      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="font-display text-base font-semibold text-text">
          Add to a group
        </h2>
        <p className="mt-2 font-label text-sm text-muted">
          This player is playing anonymously — they'll need to sign in before
          they can join a group.
        </p>
      </section>
    )
  }

  async function handleAdd() {
    const target = groupId || options[0]?.id
    if (!target) return
    setError(null)
    try {
      await quickAdd.mutateAsync({ groupId: target, profileId: person.profile_id })
      setAdded(groups.find((g) => g.id === target)?.name ?? 'the group')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-display text-base font-semibold text-text">
        Add to a group
      </h2>
      <p className="mt-1 font-label text-sm text-muted">
        Bring this player into one of your groups so you share its rules and
        defaults.
      </p>
      <div className="mt-3 flex gap-2">
        <Select
          className="flex-1"
          value={groupId || options[0]?.id || ''}
          onChange={(e) => setGroupId(e.target.value)}
          aria-label="Choose a group"
        >
          {options.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          onClick={handleAdd}
          disabled={quickAdd.isPending || options.length === 0}
        >
          {quickAdd.isPending ? 'Adding…' : 'Add'}
        </Button>
      </div>
      {added ? (
        <div className="mt-2">
          <FormMessage tone="success">Added to {added}.</FormMessage>
        </div>
      ) : null}
      {error ? (
        <div className="mt-2">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      ) : null}
    </section>
  )
}

function PlayerRoundsCard({ profileId }: { profileId: string }) {
  const navigate = useNavigate()
  const { data: rounds = [], isLoading } = usePlayerRounds(profileId)
  const { data: stats } = usePlayerStats(profileId)

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-display text-base font-semibold text-text">
        Rounds you can see
      </h2>
      {stats && stats.rounds_played > 0 ? (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Played" value={stats.rounds_played} />
          <Stat label="Wins" value={stats.wins} />
          <Stat
            label="Best finish"
            value={stats.best_rank != null ? `#${stats.best_rank}` : '—'}
          />
        </dl>
      ) : null}
      {isLoading ? (
        <p className="mt-2 font-label text-sm text-muted">Loading rounds…</p>
      ) : rounds.length === 0 ? (
        <p className="mt-2 font-label text-sm text-muted">
          No shared rounds to show yet — rounds you both played (or in a group
          you share) will appear here.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rounds.map((round) => (
            <li key={round.id}>
              <button
                type="button"
                onClick={() => navigate(`/round/${round.id}`)}
                className="w-full rounded-card border border-border bg-surface-alt p-3 text-left hover:opacity-90"
              >
                <span className="block font-label text-sm font-semibold text-text">
                  {round.course_name || 'Round'}
                </span>
                <span className="block font-label text-xs text-muted">
                  {round.played_on} ·{' '}
                  {round.scoring_mode === 'single_phone'
                    ? 'Single phone'
                    : 'Multi phone'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-card bg-surface-alt px-2 py-2">
      <dt className="font-label text-xs text-muted">{label}</dt>
      <dd className="font-numeral text-lg font-bold text-text">{value}</dd>
    </div>
  )
}
