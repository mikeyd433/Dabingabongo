interface AvatarProps {
  name: string
  url?: string | null
  /** Tailwind size classes for the square (default 40px). */
  sizeClass?: string
}

/**
 * Token-driven avatar: the uploaded image, or the player's initial on a themed
 * surface when there's none. Shared by People list/profile and anywhere a player
 * appears (spec §11).
 */
export function Avatar({ name, url, sizeClass = 'h-10 w-10' }: AvatarProps) {
  const initial = name.trim()[0]?.toUpperCase() ?? '?'
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-alt font-display text-muted ${sizeClass}`}
      aria-hidden={Boolean(url)}
    >
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </div>
  )
}
