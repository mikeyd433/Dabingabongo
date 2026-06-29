import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useRound, useRoundRealtime } from '@/lib/rounds'
import { useTheme } from '@/themes'
import { LobbyView } from './RoundLobbyScreen'
import { LiveRoundScreen } from './LiveRoundScreen'
import { ResultsScreen } from './ResultsScreen'
import type { Round } from '@/types'

/**
 * A round you're in (`/round/:roundId`). Owns the round fetch and the single
 * Realtime channel, then renders the right surface for the round's state:
 * lobby (Screen 2), live scoring (Phase 4), or the end-of-round flow (Phase 6).
 */
export function RoundDetailScreen() {
  const { roundId } = useParams()
  const { data: round, isLoading } = useRound(roundId)
  useRoundRealtime(roundId)
  useRoundTheme(round)

  if (isLoading) return <Centered>Loading round…</Centered>
  if (!round) return <Centered>Round not found.</Centered>

  if (round.status === 'lobby') return <LobbyView round={round} />
  if (round.status === 'active') return <LiveRoundScreen round={round} />

  // status === 'complete' — end-of-round results & scorecards (spec §10).
  return <ResultsScreen round={round} />
}

/**
 * Apply the round's snapshotted theme (spec §13, principle 2) while it's on
 * screen, then restore the previous app/group-default theme on leave — so a round
 * always renders in the theme it was created with, lobby through results, without
 * permanently changing the rest of the app. The header switcher still wins live.
 */
function useRoundTheme(round: Round | null | undefined) {
  const { theme, setThemeId } = useTheme()
  const previousId = useRef(theme.id)
  const snapshotThemeId =
    round && round.theme_snapshot
      ? (round.theme_snapshot as { id?: string }).id
      : undefined

  useEffect(() => {
    if (!snapshotThemeId) return
    const restoreTo = previousId.current
    setThemeId(snapshotThemeId)
    return () => setThemeId(restoreTo)
  }, [snapshotThemeId, setThemeId])
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center font-label text-sm text-muted">
      {children}
    </div>
  )
}
