import { themes } from '@/themes'

/**
 * Theme picker with live token previews (spec §5, §13). Each swatch renders using
 * that theme's own tokens — a taste of the full gallery built in Phase 7.
 */
export function ThemePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (themeId: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {themes.map((theme) => {
        const t = theme.tokens
        const selected = theme.id === value
        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => onChange(theme.id)}
            aria-pressed={selected}
            className="rounded-card border-2 p-1 text-left transition-opacity"
            style={{
              borderColor: selected
                ? 'var(--color-accent)'
                : 'var(--color-border)',
            }}
          >
            <div
              className="rounded-card p-3"
              style={{
                background: t['--color-bg'],
                color: t['--color-text'],
                fontFamily: t['--font-label'],
              }}
            >
              <div
                className="rounded px-2 py-1 text-xs font-semibold"
                style={{
                  background: t['--color-surface'],
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: t['--color-border'],
                }}
              >
                {theme.name}
              </div>
              <div className="mt-2 flex items-center gap-1">
                <Dot color={t['--color-accent']} />
                <Dot color={t['--color-winner']} />
                <span
                  className="ml-auto text-sm font-bold"
                  style={{
                    color: t['--color-accent'],
                    fontFamily: t['--font-numeral'],
                  }}
                >
                  −2
                </span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3 w-3 rounded-full"
      style={{ background: color }}
    />
  )
}
