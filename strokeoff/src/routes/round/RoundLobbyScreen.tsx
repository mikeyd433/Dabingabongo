import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { FormMessage } from '@/components/FormMessage'
import { useAuth } from '@/lib/auth'
import { useAddGuest, useRoundPlayers, useStartRound } from '@/lib/rounds'
import { errorMessage } from '@/lib/validation'
import type { Round } from '@/types'

/**
 * Lobby — Screen 2 (spec §5). Gather players, then the creator starts the round.
 * Presentational: the parent RoundDetailScreen owns the round fetch + Realtime
 * channel and only renders this while the round is in the `lobby` state.
 */
export function LobbyView({ round }: { round: Round }) {
  const { user } = useAuth()
  const { data: players } = useRoundPlayers(round.id)

  const isCreator = round.created_by === user?.id
  const joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${import.meta.env.BASE_URL}round?join=${round.code}`
      : ''

  return (
    <div className="flex flex-col gap-4 p-4">
      <Header round={round} />

      <section className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface p-4">
        <p className="font-label text-sm text-muted">
          Scan to join, or enter the code
        </p>
        <div className="rounded-card bg-surface p-2">
          <QRCodeSVG
            value={joinUrl}
            size={176}
            bgColor="var(--color-surface)"
            fgColor="var(--color-text)"
          />
        </div>
        <p className="font-numeral text-2xl font-bold tracking-widest text-accent">
          {round.code}
        </p>
      </section>

      <Roster players={players} />

      {round.scoring_mode === 'single_phone' ? (
        <AddGuest roundId={round.id} />
      ) : null}

      {isCreator ? (
        <StartRow roundId={round.id} />
      ) : (
        <p className="text-center font-label text-sm text-muted">
          Waiting for the host to start the round…
        </p>
      )}
    </div>
  )
}

function Header({
  round,
}: {
  round: { course_name: string; played_on: string; scoring_mode: string }
}) {
  return (
    <div>
      <h1 className="font-display text-xl font-bold text-text">
        {round.course_name || 'Lobby'}
      </h1>
      <p className="font-label text-xs text-muted">
        {round.played_on} ·{' '}
        {round.scoring_mode === 'single_phone' ? 'Single phone' : 'Multi phone'}
      </p>
    </div>
  )
}

function Roster({
  players,
}: {
  players:
    | {
        id: string
        display_name: string
        is_guest: boolean
        avatar_url: string | null
      }[]
    | undefined
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-label text-sm font-semibold text-text">
        Players ({players?.length ?? 0})
      </h2>
      <ul className="mt-2 flex flex-col gap-2">
        {(players ?? []).map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 font-label text-sm text-text"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Avatar
                name={p.display_name}
                url={p.avatar_url}
                sizeClass="h-8 w-8"
              />
              <span className="truncate">{p.display_name}</span>
            </span>
            {p.is_guest ? (
              <span className="font-label text-xs text-muted">Guest</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

function AddGuest({ roundId }: { roundId: string }) {
  const addGuest = useAddGuest(roundId)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-label text-sm font-semibold text-text">
        Add a guest
      </h2>
      <p className="mt-1 font-label text-xs text-muted">
        Pre-add a player who isn't holding a phone.
      </p>
      <div className="mt-2 flex gap-2">
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Guest name"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={addGuest.isPending || name.trim().length === 0}
          onClick={() => {
            setError(null)
            addGuest.mutate(name.trim(), {
              onSuccess: () => setName(''),
              onError: (e) => setError(errorMessage(e)),
            })
          }}
        >
          Add
        </Button>
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </section>
  )
}

function StartRow({ roundId }: { roundId: string }) {
  const startRound = useStartRound()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        disabled={startRound.isPending}
        onClick={() => {
          setError(null)
          startRound.mutate(roundId, {
            onError: (e) => setError(errorMessage(e)),
          })
        }}
      >
        {startRound.isPending ? 'Starting…' : 'Start round'}
      </Button>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  )
}
