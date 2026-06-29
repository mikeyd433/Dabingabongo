import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { FormMessage } from '@/components/FormMessage'
import { useAuth } from '@/lib/auth'
import {
  useAddGuest,
  useRound,
  useRoundPlayers,
  useRoundRealtime,
  useStartRound,
} from '@/lib/rounds'
import { errorMessage } from '@/lib/validation'

/** Lobby — Screen 2 (spec §5). Gather players, then the creator starts the round. */
export function RoundLobbyScreen() {
  const { roundId } = useParams()
  const { user } = useAuth()
  const { data: round, isLoading } = useRound(roundId)
  const { data: players } = useRoundPlayers(roundId)
  useRoundRealtime(roundId)

  if (isLoading) return <Centered>Loading round…</Centered>
  if (!round) return <Centered>Round not found.</Centered>

  const isCreator = round.created_by === user?.id
  const joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${import.meta.env.BASE_URL}round?join=${round.code}`
      : ''

  if (round.status === 'active') {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Header round={round} />
        <Roster players={players} />
        <div className="rounded-card border border-border bg-surface p-4 text-center">
          <p className="font-label text-sm text-muted">
            Round is live. Live scoring arrives in Phase 4.
          </p>
        </div>
      </div>
    )
  }

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
  players: { id: string; display_name: string; is_guest: boolean }[] | undefined
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-label text-sm font-semibold text-text">
        Players ({players?.length ?? 0})
      </h2>
      <ul className="mt-2 flex flex-col gap-1">
        {(players ?? []).map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between font-label text-sm text-text"
          >
            <span>{p.display_name}</span>
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

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center font-label text-sm text-muted">
      {children}
    </div>
  )
}
