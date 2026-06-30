import { themes } from '@/themes'
import type { Theme } from '@/themes'

/**
 * Theme gallery with live previews (spec §5, §13). Every tile renders a miniature
 * scorecard using *that theme's own* tokens (so the preview can't use Tailwind's
 * active-theme classes — it reads the bundle directly), giving a real taste of how
 * the whole round will look before it's picked and snapshotted on Start.
 */
export function ThemePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (themeId: string) => void
}) {
  return (
    // A capped, scrolling window so the gallery doesn't take up half the screen.
    <div className="max-h-64 overflow-y-auto rounded-card border border-border p-2">
      <div className="grid grid-cols-2 gap-3">
        {themes.map((theme) => (
          <ThemeTile
            key={theme.id}
            theme={theme}
            selected={theme.id === value}
            onClick={() => onChange(theme.id)}
          />
        ))}
      </div>
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
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${theme.name} theme`}
      className="rounded-card p-1 text-left transition-opacity"
      style={{
        borderWidth: selected ? 2 : 1,
        borderStyle: 'solid',
        borderColor: selected ? 'var(--color-accent)' : 'var(--color-border)',
      }}
    >
      {/* Mini scorecard rendered in the theme's own tokens. */}
      <div
        className="p-2"
        style={{
          background: t['--color-bg'],
          color: t['--color-text'],
          fontFamily: t['--font-label'],
          borderRadius: t['--radius-card'],
        }}
      >
        <div
          className="px-2 py-1.5"
          style={{
            background: t['--color-surface'],
            borderRadius: t['--radius-card'],
            borderWidth: t['--border-width-card'],
            borderStyle: 'solid',
            borderColor: t['--color-border'],
          }}
        >
          <div
            className="text-xs font-bold"
            style={{ fontFamily: t['--font-display'] }}
          >
            {theme.name}
          </div>
          {/* Winner row */}
          <Row
            name="Jordan"
            score="52"
            t={t}
            highlight
          />
          <Row name="Casey" score="55" t={t} />
        </div>
        <div className="mt-1 flex items-center gap-1 px-1">
          <Dot color={t['--color-accent']} />
          <Dot color={t['--color-winner']} />
          <span
            className="ml-auto text-xs font-bold"
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
}

function Row({
  name,
  score,
  t,
  highlight,
}: {
  name: string
  score: string
  t: Theme['tokens']
  highlight?: boolean
}) {
  return (
    <div
      className="mt-1 flex items-center justify-between rounded px-1 text-[10px]"
      style={highlight ? { background: t['--color-surface-alt'] } : undefined}
    >
      <span style={{ color: highlight ? t['--color-winner'] : t['--color-text'] }}>
        {name}
      </span>
      <span
        style={{
          fontFamily: t['--font-numeral'],
          color: t['--color-muted'],
        }}
      >
        {score}
      </span>
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
