/**
 * Token-driven placeholder block (spec §11). A subtle pulse on a themed surface,
 * used in loading states in place of bare "Loading…" text. Size it with
 * `className` (e.g. `h-6 w-32`).
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-card bg-surface-alt ${className}`}
      aria-hidden
    />
  )
}

/** A few skeleton lines, for paragraph-shaped placeholders. */
export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  )
}
