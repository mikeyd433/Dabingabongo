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
  useCopyPublicRule,
  useCreateRule,
  useDeleteRule,
  usePublicRules,
  useRules,
  useUpdateRule,
} from '@/lib/rules'
import { errorMessage } from '@/lib/validation'
import type { Rule } from '@/types'

type ScopeFilter = 'all' | 'single' | 'multi' | 'everyone'
type ActiveFilter = 'all' | 'active' | 'inactive'
type LibraryView = 'group' | 'global'

/** Rules tab (spec §3, §7): the group's shared, fully-editable rule library. */
export function RulesScreen() {
  const { user, loading } = useAuth()
  const { data: groups } = useMyGroups()

  const [groupId, setGroupId] = useState<string | undefined>()
  const [view, setView] = useState<LibraryView>('group')
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
      <ViewTabs view={view} onChange={setView} />

      {view === 'group' && groups && groups.length > 1 ? (
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

      {view === 'group' ? (
        <RuleLibrary groupId={activeGroupId} />
      ) : (
        <GlobalLibrary groupId={activeGroupId} />
      )}
    </div>
  )
}

/** Group library ↔ global library switch. */
function ViewTabs({
  view,
  onChange,
}: {
  view: LibraryView
  onChange: (v: LibraryView) => void
}) {
  const tabs: { id: LibraryView; label: string }[] = [
    { id: 'group', label: 'My library' },
    { id: 'global', label: 'Global library' },
  ]
  return (
    <div
      role="tablist"
      aria-label="Rule library"
      className="flex gap-1 rounded-card border border-border bg-surface p-1"
    >
      {tabs.map((t) => {
        const selected = view === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.id)}
            className="min-h-[44px] flex-1 rounded-card px-3 font-label text-sm font-semibold transition-colors"
            style={
              selected
                ? {
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-accent-contrast)',
                  }
                : { color: 'var(--color-muted)' }
            }
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * The global library (spec §7): every published rule, browsable by anyone.
 * "Copy to my group" imports a private, editable copy into the selected group.
 */
function GlobalLibrary({ groupId }: { groupId: string | undefined }) {
  const { data: rules, isLoading, error } = usePublicRules()
  const copyRule = useCopyPublicRule(groupId)
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rules ?? []
    return (rules ?? []).filter((r) =>
      `${r.name} ${r.description ?? ''}`.toLowerCase().includes(q),
    )
  }, [rules, search])

  function copy(rule: Rule) {
    setCopyError(null)
    copyRule.mutate(rule.id, {
      onSuccess: () => setCopiedId(rule.id),
      onError: (e) => setCopyError(errorMessage(e)),
    })
  }

  if (error) {
    return <FormMessage tone="error">Couldn't load the global library.</FormMessage>
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="font-display text-lg font-bold text-text">
          Global library
        </h1>
        <p className="mt-0.5 font-label text-xs text-muted">
          Rules players have made public. Copy any into your group to use and edit
          it.
        </p>
      </div>

      <TextInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search public rules"
        aria-label="Search public rules"
      />

      {copyError ? <FormMessage tone="error">{copyError}</FormMessage> : null}

      {isLoading ? (
        <Centered>Loading global library…</Centered>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={rules?.length ? 'No matches' : 'Nothing public yet'}
          message={
            rules?.length
              ? 'Try a different search.'
              : 'Publish a rule from your library to seed the global library.'
          }
        />
      ) : (
        <ul className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto">
          {filtered.map((rule) => (
            <li key={rule.id}>
              <PublicRuleRow
                rule={rule}
                copied={copiedId === rule.id}
                pending={copyRule.isPending}
                onCopy={() => copy(rule)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PublicRuleRow({
  rule,
  copied,
  pending,
  onCopy,
}: {
  rule: Rule
  copied: boolean
  pending: boolean
  onCopy: () => void
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="font-label text-sm font-semibold text-text">
            {rule.name}
          </span>
          {rule.description ? (
            <p className="mt-0.5 font-label text-xs text-muted">
              {rule.description}
            </p>
          ) : null}
          <p className="mt-1 font-numeral text-xs text-muted">
            +{rule.points} pt{rule.points === 1 ? '' : 's'}
            {rule.is_scalable ? ` / ${rule.quantity_label || 'unit'}` : ''} ·{' '}
            {scopeLabel(rule.player_scope)} ·{' '}
            {rule.is_repeatable ? 'Repeatable' : 'Once per round'}
          </p>
        </div>
        <div className="shrink-0">
          <Button
            type="button"
            variant="secondary"
            disabled={pending || copied}
            onClick={onCopy}
          >
            {copied ? 'Copied' : 'Copy to my group'}
          </Button>
        </div>
      </div>
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
          <option value="everyone">Everyone</option>
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
        <ul
          className={`flex flex-col gap-2 ${
            // Cap into a scrolling window, but let the inline editor expand freely.
            editing ? '' : 'max-h-[28rem] overflow-y-auto'
          }`}
        >
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
            +{rule.points} pt{rule.points === 1 ? '' : 's'}
            {rule.is_scalable ? ` / ${rule.quantity_label || 'unit'}` : ''} ·{' '}
            {scopeLabel(rule.player_scope)} ·{' '}
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

function scopeLabel(scope: Rule['player_scope']): string {
  if (scope === 'multi') return 'Multi-player'
  if (scope === 'everyone') return 'Everyone'
  return 'Single'
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-10 text-center font-label text-sm text-muted">
      {children}
    </div>
  )
}
