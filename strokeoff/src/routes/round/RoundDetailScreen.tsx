import { useParams } from 'react-router-dom'
import { useRound, useRoundRealtime } from '@/lib/rounds'
import { LobbyView } from './RoundLobbyScreen'
import { LiveRoundScreen } from './LiveRoundScreen'
import { ResultsScreen } from './ResultsScreen'

/**
 * A round you're in (`/round/:roundId`). Owns the round fetch and the single
 * Realtime channel, then renders the right surface for the round's state:
 * lobby (Screen 2), live scoring (Phase 4), or the end-of-round flow (Phase 6).
 */
export function RoundDetailScreen() {
  const { roundId } = useParams()
  const { data: round, isLoading } = useRound(roundId)
  useRoundRealtime(roundId)

  if (isLoading) return <Centered>Loading round…</Centered>
  if (!round) return <Centered>Round not found.</Centered>

  if (round.status === 'lobby') return <LobbyView round={round} />
  if (round.status === 'active') return <LiveRoundScreen round={round} />

  // status === 'complete' — end-of-round results & scorecards (spec §10).
  return <ResultsScreen round={round} />
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center font-label text-sm text-muted">
      {children}
    </div>
  )
}
