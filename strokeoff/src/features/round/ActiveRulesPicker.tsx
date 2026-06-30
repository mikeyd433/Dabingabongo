import { useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import type { Rule } from '@/types'

/**
 * Active-rules selection for a round (spec §5): searchable list with bulk
 * enable/disable. New rounds default to all rules on (handled by the caller).
 */
export function ActiveRulesPicker({
  rules,
  selected,
  onChange,
}: {
  rules: Rule[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rules
    return rules.filter((r) =>
      `${r.name} ${r.description ?? ''}`.toLowerCase().includes(q),
    )
  }, [rules, search])

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  function setAll(on: boolean) {
    onChange(on ? new Set(rules.map((r) => r.id)) : new Set())
  }

  return (
    <div className="flex flex-col gap-2">
      <TextInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search rules"
        aria-label="Search rules"
      />
      <div className="flex items-center justify-between">
        <span className="font-label text-xs text-muted">
          {selected.size} of {rules.length} on
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setAll(true)}
          >
            All on
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setAll(false)}
          >
            All off
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="font-label text-xs text-muted">No rules match your search.</p>
      ) : (
      // A capped, scrolling window so a long library doesn't fill the screen.
      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {filtered.map((rule) => (
          <li key={rule.id}>
            <label className="flex min-h-[44px] items-center justify-between gap-3 rounded-card border border-border bg-surface px-3">
              <span className="min-w-0">
                <span className="font-label text-sm text-text">
                  {rule.name}
                </span>
                <span className="ml-2 font-numeral text-xs text-muted">
                  +{rule.points}
                  {rule.is_scalable ? `/${rule.quantity_label || 'unit'}` : ''}
                </span>
                {rule.player_scope === 'everyone' ? (
                  <span className="ml-2 font-label text-xs text-accent">
                    everyone
                  </span>
                ) : rule.player_scope === 'multi' ? (
                  <span className="ml-2 font-label text-xs text-muted">group</span>
                ) : null}
              </span>
              <input
                type="checkbox"
                checked={selected.has(rule.id)}
                onChange={() => toggle(rule.id)}
                className="h-5 w-5 accent-[var(--color-accent)]"
              />
            </label>
          </li>
        ))}
      </ul>
      )}
    </div>
  )
}
