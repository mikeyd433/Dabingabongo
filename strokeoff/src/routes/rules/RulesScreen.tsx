import { useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { Select } from '@/components/Select'
import { EmptyState } from '@/components/EmptyState'
import { FormMessage } from '@/components/FormMessage'
import { RuleEditor } from '@/features/rules/RuleEditor'
import { useAuth } from '@/lib/auth'
import { useMyGroups } from '@/lib/profile'
import {
  useCreateRule,
  useDeleteRule,
  useRules,
  useUpdateRule,
} from '@/lib/rules'
import type { Rule } from '@/types'

type ScopeFilter = 'all' | 'single' | 'multi'
type ActiveFilter = 'all' | 'active' | 'inactive'

/** Rules tab (spec §3, §7): the group's shared, fully-editable rule library. */
export function RulesScreen() {
  const { user, loading } = useAuth()
  const { data: groups } = useMyGroups()

  const [groupId, setGroupId] = useState<string | undefined>()
  const activeGroupId =
    groupId ??
    groups?.find((g) => g.is_personal)?.id ??
    groups?.[0]?.id ??
    undefined

  if (loading) return <Centered>Loading…</Centered>

  if (!user) {
    return (
      <EmptyState
        title="Build your rule library"
        message="Pick a display name on Home to start — your rules live in your group's shared library."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {groups && groups.length > 1 ? (
        <label className="flex items-center gap-2">
          <span className="font-label text-sm text-muted">Group</span>
          <Select
            value={activeGroupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="flex-1"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </label>
      ) : null}

      <RuleLibrary groupId={activeGroupId} />
    </div>
  )
}

function RuleLibrary({ groupId }: { groupId: string | undefined }) {
  const { data: rules, isLoading, error } = useRules(groupId)
  const createRule = useCreateRule(groupId)
  const updateRule = useUpdateRule(groupId)
  const deleteRule = useDeleteRule(groupId)

  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<ScopeFilter>('all')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [editing, setEditing] = useState<Rule | null>(null)
  const [adding, setAdding] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (rules ?? []).filter((r) => {
      if (scope !== 'all' && r.player_scope !== scope) return false
      if (activeFilter === 'active' && !r.active) return false
      if (activeFilter === 'inactive' && r.active) return false
      if (q && !`${r.name} ${r.description ?? ''}`.toLowerCase().includes(q)) {
        return false
      }
      return true
    })
  }, [rules, search, scope, activeFilter])

  if (error) {
    return <FormMessage tone="error">Couldn't load rules.</FormMessage>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-lg font-bold text-text">Rules</h1>
        {!adding && !editing ? (
          <Button type="button" onClick={() => setAdding(true)}>
            Add rule
          </Button>
        ) : null}
      </div>

      {adding ? (
        <RuleEditor
          onSave={async (draft) => {
            await createRule.mutateAsync(draft)
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      ) : null}

      <TextInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search rules"
        aria-label="Search rules"
      />
      <div className="flex gap-2">
        <Select
          value={scope}
          onChange={(e) => setScope(e.target.value as ScopeFilter)}
          aria-label="Filter by player scope"
          className="flex-1"
        >
          <option value="all">All scopes</option>
          <option value="single">Single player</option>
          <option value="multi">Multi-player</option>
        </Select>
        <Select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
          aria-label="Filter by status"
          className="flex-1"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      {isLoading ? (
        <Centered>Loading rules…</Centered>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={rules?.length ? 'No matches' : 'No rules yet'}
          message={
            rules?.length
              ? 'Try a different search or filter.'
              : 'Add your first rule to start your group library.'
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((rule) =>
            editing?.id === rule.id ? (
              <li key={rule.id}>
                <RuleEditor
                  initial={rule}
                  onSave={async (patch) => {
                    await updateRule.mutateAsync({ id: rule.id, patch })
                    setEditing(null)
                  }}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={rule.id}>
                <RuleRow
                  rule={rule}
                  onEdit={() => setEditing(rule)}
                  onDelete={() => deleteRule.mutate(rule.id)}
                />
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}

function RuleRow({
  rule,
  onEdit,
  onDelete,
}: {
  rule: Rule
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-label text-sm font-semibold text-text">
              {rule.name}
            </span>
            {!rule.active ? (
              <span className="rounded border border-border px-1.5 py-0.5 font-label text-xs text-muted">
                Inactive
              </span>
            ) : null}
          </div>
          {rule.description ? (
            <p className="mt-0.5 font-label text-xs text-muted">
              {rule.description}
            </p>
          ) : null}
          <p className="mt-1 font-numeral text-xs text-muted">
            +{rule.points} pt{rule.points === 1 ? '' : 's'} ·{' '}
            {rule.player_scope === 'multi' ? 'Multi-player' : 'Single'} ·{' '}
            {rule.is_repeatable ? 'Repeatable' : 'Once per round'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <Button type="button" variant="secondary" onClick={onEdit}>
            Edit
          </Button>
          {confirmDelete ? (
            <Button type="button" onClick={onDelete}>
              Confirm
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-10 text-center font-label text-sm text-muted">
      {children}
    </div>
  )
}
