import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/themes'
import { themes } from '@/themes'
import type { Theme } from '@/themes'

/**
 * Dev/affordance control that proves the token architecture: switching the active
 * theme here swaps the CSS-variable bundle and restyles the entire shell with no
 * component changes (Phase 0 acceptance: stat-sheet ↔ arcade). In later phases the
 * round's theme is chosen at setup and snapshotted (spec §5, §13).
 *
 * Rendered as a compact popover: the trigger shows the active theme plus a couple of
 * swatch dots; tapping it opens a grid of tiles drawn in each theme's own tokens.
 */
export function ThemeSwitcher() {
  const { theme, setThemeId } = useTheme()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Active theme"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[44px] items-center gap-2 rounded-card border border-border bg-surface px-2 py-1 font-label text-xs text-text"
      >
        <span className="sr-only sm:not-sr-only">{theme.name}</span>
        <span className="flex items-center gap-1">
          <Dot color={theme.tokens['--color-accent']} />
          <Dot color={theme.tokens['--color-winner']} />
          <Dot color={theme.tokens['--color-surface']} />
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Themes"
          className="absolute right-0 z-50 mt-1 grid max-h-[60vh] w-64 grid-cols-2 gap-2 overflow-y-auto rounded-card border border-border bg-surface p-2 shadow-lg"
        >
          {themes.map((t) => (
            <ThemeTile
              key={t.id}
              theme={t}
              selected={t.id === theme.id}
              onClick={() => {
                setThemeId(t.id)
                setOpen(false)
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ThemeTile({
  theme,
  selected,
  onClick,
}: {
  theme: Theme
  selected: boolean
  onClick: () => void
}) {
  const t = theme.tokens
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      aria-label={`${theme.name} theme`}
      onClick={onClick}
      className="flex min-h-[44px] flex-col gap-1 rounded-card p-2 text-left"
      style={{
        background: t['--color-bg'],
        color: t['--color-text'],
        fontFamily: t['--font-label'],
        borderWidth: selected ? 2 : 1,
        borderStyle: 'solid',
        borderColor: selected ? 'var(--color-accent)' : t['--color-border'],
      }}
    >
      <span
        className="truncate text-xs font-bold"
        style={{ fontFamily: t['--font-display'] }}
      >
        {theme.name}
      </span>
      <span className="flex items-center gap-1">
        <Dot color={t['--color-bg']} />
        <Dot color={t['--color-surface']} />
        <Dot color={t['--color-accent']} />
        <Dot color={t['--color-winner']} />
      </span>
    </button>
  )
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3 w-3 rounded-full border border-border"
      style={{ background: color }}
    />
  )
}
