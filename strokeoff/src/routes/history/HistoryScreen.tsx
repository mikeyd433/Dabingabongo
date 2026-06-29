import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { FormMessage } from '@/components/FormMessage'
import { Skeleton } from '@/components/Skeleton'
import { useHideRound, useHistoryRounds } from '@/lib/endRound'
import { errorMessage } from '@/lib/validation'

/**
 * History tab (spec §3, §11). Every completed round you were part of, newest
 * first; tap one to reopen its results + scorecards. Deleting removes it from
 * *your* history only — other participants keep theirs.
 */
export function HistoryScreen() {
  const { data: rounds = [], isLoading } = useHistoryRounds()
  const navigate = useNavigate()
  const hide = useHideRound()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-7 w-32" />
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
            >
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (rounds.length === 0) {
    return (
      <EmptyState
        title="No rounds yet"
        message="Your completed rounds will show up here with adjusted standings and shareable scorecards. Head to Home to start your first."
        action={
          <Button type="button" onClick={() => navigate('/round/new')}>
            Start a round
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <h1 className="font-display text-xl font-bold text-text">History</h1>
      <ul className="flex flex-col gap-2">
        {rounds.map((round) => (
          <li
            key={round.id}
            className="flex items-center justify-between gap-2 rounded-card border border-border bg-surface p-4"
          >
            <button
              type="button"
              className="flex-1 text-left"
              onClick={() => navigate(`/round/${round.id}`)}
            >
              <p className="font-label text-sm font-semibold text-text">
                {round.course_name || 'Round'}
              </p>
              <p className="font-label text-xs text-muted">
                {round.played_on} ·{' '}
                {round.scoring_mode === 'single_phone'
                  ? 'Single phone'
                  : 'Multi phone'}
              </p>
            </button>
            <button
              type="button"
              className="font-label text-xs text-muted underline disabled:opacity-50"
              disabled={hide.isPending}
              onClick={() => hide.mutate(round.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      {hide.isError ? (
        <FormMessage tone="error">{errorMessage(hide.error)}</FormMessage>
      ) : null}
    </div>
  )
}
