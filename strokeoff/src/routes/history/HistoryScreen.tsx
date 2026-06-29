import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'

/**
 * History tab placeholder (spec §3). Completed rounds you were part of. Empty state
 * points back to Home. History + detail land in Phase 6.
 */
export function HistoryScreen() {
  return (
    <EmptyState
      title="No rounds yet"
      message="Your completed rounds will show up here with adjusted standings and the full event log. Head to Home to start your first."
      action={
        <Button type="button" disabled>
          Start a round
        </Button>
      }
    />
  )
}
