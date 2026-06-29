import { useTheme } from '@/themes'
import { themes } from '@/themes'

/**
 * Dev/affordance control that proves the token architecture: switching the active
 * theme here swaps the CSS-variable bundle and restyles the entire shell with no
 * component changes (Phase 0 acceptance: stat-sheet ↔ arcade). In later phases the
 * round's theme is chosen at setup and snapshotted (spec §5, §13).
 */
export function ThemeSwitcher() {
  const { theme, setThemeId } = useTheme()

  return (
    <label className="flex items-center gap-2 font-label text-xs text-muted">
      <span className="sr-only sm:not-sr-only">Theme</span>
      <select
        aria-label="Active theme"
        value={theme.id}
        onChange={(e) => setThemeId(e.target.value)}
        className="min-h-[36px] rounded-card border border-border bg-surface px-2 py-1 font-label text-xs text-text"
      >
        {themes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  )
}
