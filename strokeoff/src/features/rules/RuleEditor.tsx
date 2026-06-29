import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { Select } from '@/components/Select'
import { FormMessage } from '@/components/FormMessage'
import { errorMessage } from '@/lib/validation'
import type { RuleDraft } from '@/lib/rules'
import type { Rule } from '@/types'
import {
  ALL_PRESETS,
  DEFAULT_ANIMATION,
  PRESET_LABELS,
  normalizeAnimation,
  type AnimationConfig,
  type AnimationPreset,
} from '@/features/animations/types'
import { celebrate } from '@/features/animations/celebrate'
import { useUploadAnimationAsset } from '@/lib/animationAssets'
import type { ChangeEvent } from 'react'

const DISPLAY_NAME_MAX = 25 // spec §7

interface RuleEditorProps {
  initial?: Rule
  onSave: (draft: RuleDraft) => Promise<void>
  onCancel: () => void
}

function toDraft(rule?: Rule): RuleDraft {
  return {
    name: rule?.name ?? '',
    display_name: rule?.display_name ?? '',
    description: rule?.description ?? '',
    points: rule?.points ?? 1,
    player_scope: rule?.player_scope ?? 'single',
    min_players: rule?.min_players ?? null,
    max_players: rule?.max_players ?? null,
    is_repeatable: rule?.is_repeatable ?? true,
    active: rule?.active ?? true,
    animation_config: rule?.animation_config ?? { ...DEFAULT_ANIMATION },
  }
}

/** Add/edit a rule with all spec §7 fields. */
export function RuleEditor({ initial, onSave, onCancel }: RuleEditorProps) {
  const [draft, setDraft] = useState<RuleDraft>(() => toDraft(initial))
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function set<K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (draft.name.trim().length === 0) {
      setError('Give the rule a name.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await onSave({
        ...draft,
        name: draft.name.trim(),
        display_name: draft.display_name.trim(),
        description: draft.description?.trim() || null,
      })
    } catch (err) {
      setError(errorMessage(err))
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-card border border-border bg-surface-alt p-4"
    >
      <Field label="Name" htmlFor="rule-name">
        <TextInput
          id="rule-name"
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Birdie"
        />
      </Field>

      <Field
        label="Display name"
        htmlFor="rule-display-name"
        hint={`Short label for the scorecard matrix. ${draft.display_name.length}/${DISPLAY_NAME_MAX} — falls back to the name if blank.`}
      >
        <TextInput
          id="rule-display-name"
          value={draft.display_name}
          maxLength={DISPLAY_NAME_MAX}
          onChange={(e) => set('display_name', e.target.value)}
          placeholder="e.g. Birdie"
        />
      </Field>

      <Field label="Description" htmlFor="rule-description">
        <textarea
          id="rule-description"
          value={draft.description ?? ''}
          onChange={(e) => set('description', e.target.value)}
          placeholder="When is this point earned?"
          className="min-h-[64px] w-full rounded-card border border-border bg-surface px-3 py-2 font-label text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </Field>

      <div className="flex gap-3">
        <Field label="Points" htmlFor="rule-points" className="flex-1">
          <TextInput
            id="rule-points"
            type="number"
            inputMode="numeric"
            value={String(draft.points)}
            onChange={(e) => set('points', Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="Player scope" htmlFor="rule-scope" className="flex-1">
          <Select
            id="rule-scope"
            value={draft.player_scope}
            onChange={(e) =>
              set('player_scope', e.target.value as RuleDraft['player_scope'])
            }
            className="w-full"
          >
            <option value="single">Single player</option>
            <option value="multi">Multi-player</option>
          </Select>
        </Field>
      </div>

      {draft.player_scope === 'multi' ? (
        <div className="flex gap-3">
          <Field label="Min players" htmlFor="rule-min" className="flex-1">
            <TextInput
              id="rule-min"
              type="number"
              inputMode="numeric"
              value={draft.min_players == null ? '' : String(draft.min_players)}
              onChange={(e) =>
                set(
                  'min_players',
                  e.target.value === '' ? null : Number(e.target.value),
                )
              }
            />
          </Field>
          <Field label="Max players" htmlFor="rule-max" className="flex-1">
            <TextInput
              id="rule-max"
              type="number"
              inputMode="numeric"
              value={draft.max_players == null ? '' : String(draft.max_players)}
              onChange={(e) =>
                set(
                  'max_players',
                  e.target.value === '' ? null : Number(e.target.value),
                )
              }
            />
          </Field>
        </div>
      ) : null}

      <Toggle
        label="Repeatable per round"
        checked={draft.is_repeatable}
        onChange={(v) => set('is_repeatable', v)}
      />
      <Toggle
        label="Active"
        checked={draft.active}
        onChange={(v) => set('active', v)}
      />

      <AnimationField
        value={draft.animation_config}
        onChange={(cfg) => set('animation_config', cfg)}
      />

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save rule'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  className = '',
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={htmlFor} className="font-label text-sm text-text">
        {label}
      </label>
      {children}
      {hint ? (
        <span className="font-label text-xs text-muted">{hint}</span>
      ) : null}
    </div>
  )
}

/** Per-rule celebration config (spec §12): preset + color, custom emoji/image. */
function AnimationField({
  value,
  onChange,
}: {
  value: Record<string, unknown> | null
  onChange: (cfg: AnimationConfig) => void
}) {
  const cfg = normalizeAnimation(value)
  const set = (patch: Partial<AnimationConfig>) => onChange({ ...cfg, ...patch })
  const upload = useUploadAnimationAsset()
  const [uploadError, setUploadError] = useState<string | null>(null)

  function choosePreset(preset: AnimationPreset) {
    // Custom image is the only tier-2 effect today; everything else is tier 1.
    set({ preset, tier: preset === 'image-burst' ? 2 : 1 })
  }

  function handleImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    upload.mutate(file, {
      onSuccess: (url) => set({ preset: 'image-burst', tier: 2, imageUrl: url }),
      onError: (err) => setUploadError(errorMessage(err)),
    })
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="font-label text-sm text-text">Celebration</span>
        <button
          type="button"
          className="font-label text-xs font-semibold text-accent underline"
          onClick={() => celebrate(cfg)}
        >
          Preview
        </button>
      </div>
      <div className="flex gap-3">
        <Field label="Effect" htmlFor="rule-anim-preset" className="flex-1">
          <Select
            id="rule-anim-preset"
            value={cfg.preset}
            onChange={(e) => choosePreset(e.target.value as AnimationPreset)}
            className="w-full"
          >
            {ALL_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {PRESET_LABELS[preset]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Colors" htmlFor="rule-anim-color" className="flex-1">
          <Select
            id="rule-anim-color"
            value={cfg.color === 'rainbow' ? 'rainbow' : 'theme'}
            onChange={(e) => set({ color: e.target.value })}
            className="w-full"
          >
            <option value="theme">Theme</option>
            <option value="rainbow">Rainbow</option>
          </Select>
        </Field>
      </div>
      {cfg.preset === 'emoji-burst' ? (
        <Field label="Emoji" htmlFor="rule-anim-emoji">
          <TextInput
            id="rule-anim-emoji"
            value={cfg.emoji ?? ''}
            maxLength={4}
            onChange={(e) => set({ emoji: e.target.value })}
            placeholder="🎉"
          />
        </Field>
      ) : null}
      {cfg.preset === 'image-burst' ? (
        <div className="flex items-center gap-3">
          {cfg.imageUrl ? (
            <img
              src={cfg.imageUrl}
              alt="Celebration particle"
              className="h-12 w-12 rounded-card object-contain"
            />
          ) : null}
          <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-card border border-border bg-surface px-4 font-label text-sm font-semibold text-text">
            {upload.isPending
              ? 'Uploading…'
              : cfg.imageUrl
                ? 'Replace image'
                : 'Upload image'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleImage}
              disabled={upload.isPending}
            />
          </label>
        </div>
      ) : null}
      {uploadError ? <FormMessage tone="error">{uploadError}</FormMessage> : null}
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex min-h-[44px] items-center justify-between gap-3">
      <span className="font-label text-sm text-text">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-[var(--color-accent)]"
      />
    </label>
  )
}
