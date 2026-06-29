import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { Select } from '@/components/Select'
import { FormMessage } from '@/components/FormMessage'
import { ThemePicker } from '@/features/round/ThemePicker'
import { ActiveRulesPicker } from '@/features/round/ActiveRulesPicker'
import { ConversionFields } from '@/features/conversion/ConversionFields'
import type { ConversionValue } from '@/features/conversion/ConversionFields'
import { DEFAULT_TIER_CONFIG } from '@/features/conversion/types'
import { useAuth } from '@/lib/auth'
import { useMyGroups } from '@/lib/profile'
import { useGroupConversion } from '@/lib/conversion'
import { useRules } from '@/lib/rules'
import { useCreateRound } from '@/lib/rounds'
import { errorMessage } from '@/lib/validation'
import { DEFAULT_THEME_ID, getTheme } from '@/themes'
import type { ScoringMode } from '@/types'

function today() {
  return new Date().toISOString().slice(0, 10)
}

/** Round setup — Screen 1 (spec §5). Defines the round; players join in Screen 2. */
export function RoundSetupScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: groups } = useMyGroups()
  const createRound = useCreateRound()

  const [groupId, setGroupId] = useState<string | undefined>()
  const activeGroup = useMemo(
    () =>
      groups?.find((g) => g.id === groupId) ??
      groups?.find((g) => g.is_personal) ??
      groups?.[0],
    [groups, groupId],
  )

  const { data: groupConversion } = useGroupConversion(
    activeGroup?.default_conversion_id,
  )
  const { data: rules } = useRules(activeGroup?.id)

  const [course, setCourse] = useState('')
  const [playedOn, setPlayedOn] = useState(today())
  const [scoringMode, setScoringMode] = useState<ScoringMode>('multi_phone')
  const [animations, setAnimations] = useState(true)
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID)
  const [conversion, setConversion] = useState<ConversionValue>({
    mode: 'tier',
    config: DEFAULT_TIER_CONFIG,
  })
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [rulesSeeded, setRulesSeeded] = useState(false)

  // Default the theme to the group's house theme.
  useEffect(() => {
    if (activeGroup?.default_theme_id) setThemeId(activeGroup.default_theme_id)
  }, [activeGroup?.default_theme_id])

  // Seed the conversion from the group default once it loads.
  useEffect(() => {
    if (groupConversion) {
      setConversion({
        mode: groupConversion.mode,
        config: groupConversion.config as unknown as ConversionValue['config'],
      })
    }
  }, [groupConversion])

  // New rounds default to all rules on (spec §5).
  useEffect(() => {
    if (rules && !rulesSeeded) {
      setSelectedRules(new Set(rules.map((r) => r.id)))
      setRulesSeeded(true)
    }
  }, [rules, rulesSeeded])

  if (!user) {
    return (
      <Centered>Pick a display name on Home before starting a round.</Centered>
    )
  }

  async function handleConfirm() {
    if (!activeGroup) {
      setError('Pick a group first.')
      return
    }
    setError(null)
    const theme = getTheme(themeId)
    try {
      const round = await createRound.mutateAsync({
        groupId: activeGroup.id,
        course: course.trim(),
        playedOn,
        scoringMode,
        conversion,
        theme: {
          id: theme.id,
          name: theme.name,
          mode: theme.mode,
          tokens: theme.tokens as unknown as Record<string, string>,
        },
        animationsEnabled: animations,
        ruleIds: [...selectedRules],
      })
      navigate(`/round/${round.id}`)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="font-display text-xl font-bold text-text">New round</h1>

      <Field label="Group">
        <Select
          value={activeGroup?.id ?? ''}
          onChange={(e) => setGroupId(e.target.value)}
          className="w-full"
        >
          {(groups ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Course">
        <TextInput
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          placeholder="Where are you playing?"
        />
      </Field>

      <Field label="Date">
        <TextInput
          type="date"
          value={playedOn}
          onChange={(e) => setPlayedOn(e.target.value)}
        />
      </Field>

      <Field label="Scoring mode">
        <Select
          value={scoringMode}
          onChange={(e) => setScoringMode(e.target.value as ScoringMode)}
          className="w-full"
        >
          <option value="multi_phone">
            Multi phone — everyone self-scores
          </option>
          <option value="single_phone">
            Single phone — one controller scores
          </option>
        </Select>
      </Field>

      <Field label="Conversion">
        <ConversionFields initial={conversion} onChange={setConversion} />
      </Field>

      <Field label="Theme">
        <ThemePicker value={themeId} onChange={setThemeId} />
      </Field>

      <Field label="Active rules">
        <ActiveRulesPicker
          rules={rules ?? []}
          selected={selectedRules}
          onChange={setSelectedRules}
        />
      </Field>

      <label className="flex min-h-[44px] items-center justify-between gap-3">
        <span className="font-label text-sm text-text">Animations</span>
        <input
          type="checkbox"
          checked={animations}
          onChange={(e) => setAnimations(e.target.checked)}
          className="h-5 w-5 accent-[var(--color-accent)]"
        />
      </label>

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={createRound.isPending}
        >
          {createRound.isPending ? 'Creating…' : 'Continue to lobby'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate('/round')}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-label text-sm font-semibold text-text">
        {label}
      </span>
      {children}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center font-label text-sm text-muted">
      {children}
    </div>
  )
}
