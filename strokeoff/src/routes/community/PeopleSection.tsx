/**
 * Community → People (spec §11). Built out in Phase 11 — people appear after you
 * share a round. Phase 1 shows the invitation-style empty state.
 */
export function PeopleSection() {
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-display text-base font-semibold text-text">People</h2>
      <p className="mt-2 font-label text-sm text-muted">
        People you've played with appear here after a shared round — no global
        directory, just your crew.
      </p>
    </section>
  )
}
