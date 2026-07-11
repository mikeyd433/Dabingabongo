import { useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { FormMessage } from '@/components/FormMessage'
import { RuleEditor } from '@/features/rules/RuleEditor'
import { useCreateRule, useRules, type RuleDraft } from '@/lib/rules'
import {
  useAddRoundRule,
  useRemoveRoundRule,
  useRoundRules,
} from '@/lib/scoring'
import { errorMessage } from '@/lib/validation'
import type { Round, RoundRule } from '@/types'

/**
 * Mid-round rule management (host only; spec §7). The round's active-rule set can
 * be adjusted while the round is in the lobby or live: toggle library rules
 * on/off, or author a brand-new rule on the fly. Non-host participants see the
 * current active rules read-only. Every change is snapshotted server-side and
 * pushed to all participants via Realtime (migration 0019 + useRoundRealtime).
 */
export function RoundRulesManager({
  round,
  isHost,
}: {
  round: Pick<Round, 'id' | 'group_id'>
  isHost: boolean
}) {
  const { data: roundRules } = useRoundRules(round.id)

  if (!isHost) {
    return <ReadOnlyRules roundRules={roundRules} />
  }
  return <HostRulesEditor round={round} roundRules={roundRules} />
}

/* ------------------------------------------------------------- participant view */

function ReadOnlyRules({ roundRules }: { roundRules: RoundRule[] | undefined }) {
  return (
    <Section count={roundRules?.length ?? 0}>
      {(roundRules?.length ?? 0) === 0 ? (
        <p className="font-label text-sm text-muted">
          No rules are active in this round.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {(roundRules ?? []).map((r) => (
            <li
              key={r.rule_id}
              className="flex items-center justify-between gap-2 font-label text-sm text-text"
            >
              <span className="truncate">{r.name_snapshot}</span>
              <span className="shrink-0 font-numeral text-xs text-muted">
                +{r.points_snapshot}
                {r.is_scalable ? `/${r.quantity_label || 'unit'}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 font-label text-xs text-muted">
        Only the host can change rules during the round.
      </p>
    </Section>
  )
}

/* -------------------------------------------------------------------- host view */

interface LibraryRow {
  id: string
  name: string
  points: number
  is_scalable: boolean
  quantity_label: string | null
  player_scope: RoundRule['player_scope']
}

function HostRulesEditor({
  round,
  roundRules,
}: {
  round: Pick<Round, 'id' | 'group_id'>
  roundRules: RoundRule[] | undefined
}) {
  const { data: groupRules } = useRules(round.group_id)
  const addRule = useAddRoundRule(round.id)
  const removeRule = useRemoveRoundRule(round.id)
  const createRule = useCreateRule(round.group_id)

  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeIds = useMemo(
    () => new Set((roundRules ?? []).map((r) => r.rule_id)),
    [roundRules],
  )

  // Library rules, plus any active rule that was deleted from the library
  // mid-round (kept so the host can still turn it off).
  const rows = useMemo<LibraryRow[]>(() => {
    const library = groupRules ?? []
    const known = new Set(library.map((r) => r.id))
    const knownRows: LibraryRow[] = library.map((r) => ({
      id: r.id,
      name: r.name,
      points: r.points,
      is_scalable: r.is_scalable,
      quantity_label: r.quantity_label,
      player_scope: r.player_scope,
    }))
    const orphans: LibraryRow[] = (roundRules ?? [])
      .filter((r) => !known.has(r.rule_id))
      .map((r) => ({
        id: r.rule_id,
        name: r.name_snapshot,
        points: r.points_snapshot,
        is_scalable: r.is_scalable,
        quantity_label: r.quantity_label,
        player_scope: r.player_scope,
      }))
    return [...knownRows, ...orphans]
  }, [groupRules, roundRules])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(q))
  }, [rows, search])

  function toggle(ruleId: string, currentlyActive: boolean) {
    setError(null)
    const mutation = currentlyActive ? removeRule : addRule
    mutation.mutate(ruleId, { onError: (e) => setError(errorMessage(e)) })
  }

  async function handleCreate(draft: RuleDraft) {
    setError(null)
    const rule = await createRule.mutateAsync(draft)
    await addRule.mutateAsync(rule.id)
    setCreating(false)
  }

  const pending = addRule.isPending || removeRule.isPending

  return (
    <Section
      count={activeIds.size}
      action={
        <Button
          type="button"
          variant="secondary"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Done' : 'Edit rules'}
        </Button>
      }
    >
      {!expanded ? (
        <ActiveSummary roundRules={roundRules} />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="font-label text-xs text-muted">
              {activeIds.size} active
            </span>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreating((c) => !c)}
            >
              {creating ? 'Close' : 'New rule'}
            </Button>
          </div>

          {creating ? (
            <div className="mt-2">
              <RuleEditor
                onSave={handleCreate}
                onCancel={() => setCreating(false)}
              />
            </div>
          ) : null}

          <div className="mt-2">
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rules"
              aria-label="Search rules"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="mt-2 font-label text-sm text-muted">
              No rules match your search.
            </p>
          ) : (
            // A capped, scrolling window so a long library doesn't fill the screen.
            <ul className="mt-2 flex max-h-72 flex-col gap-1 overflow-y-auto">
              {filtered.map((rule) => {
                const active = activeIds.has(rule.id)
                return (
                  <li key={rule.id}>
                    <label className="flex min-h-[44px] items-center justify-between gap-3 rounded-card border border-border bg-surface px-3">
                      <span className="min-w-0">
                        <span className="font-label text-sm text-text">
                          {rule.name}
                        </span>
                        <span className="ml-2 font-numeral text-xs text-muted">
                          +{rule.points}
                          {rule.is_scalable
                            ? `/${rule.quantity_label || 'unit'}`
                            : ''}
                        </span>
                        {rule.player_scope === 'everyone' ? (
                          <span className="ml-2 font-label text-xs text-accent">
                            everyone
                          </span>
                        ) : rule.player_scope === 'multi' ? (
                          <span className="ml-2 font-label text-xs text-muted">
                            group
                          </span>
                        ) : null}
                      </span>
                      <input
                        type="checkbox"
                        checked={active}
                        disabled={pending}
                        onChange={() => toggle(rule.id, active)}
                        className="h-5 w-5 accent-[var(--color-accent)]"
                      />
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </Section>
  )
}

/** Compact read-out of the currently active rules (collapsed host view). */
function ActiveSummary({ roundRules }: { roundRules: RoundRule[] | undefined }) {
  if ((roundRules?.length ?? 0) === 0) {
    return (
      <p className="font-label text-sm text-muted">
        No rules are active — tap “Edit rules” to add some.
      </p>
    )
  }
  return (
    <p className="font-label text-sm text-muted">
      {(roundRules ?? []).map((r) => r.name_snapshot).join(' · ')}
    </p>
  )
}

function Section({
  count,
  action,
  children,
}: {
  count: number
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-label text-sm font-semibold text-text">
          Rules ({count})
        </h2>
        {action}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  )
}
