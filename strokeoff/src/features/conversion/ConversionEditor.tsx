import { useState } from 'react'
import { Button } from '@/components/Button'
import { FormMessage } from '@/components/FormMessage'
import { errorMessage } from '@/lib/validation'
import { useUpdateConversion } from '@/lib/conversion'
import { ConversionFields, type ConversionValue } from './ConversionFields'
import { DEFAULT_TIER_CONFIG, type RatioConfig, type TierConfig } from './types'
import type { ConversionTable } from '@/types'

/** Edit a group's default points→strokes conversion (spec §8) and persist it. */
export function ConversionEditor({ table }: { table: ConversionTable }) {
  const update = useUpdateConversion()
  const [value, setValue] = useState<ConversionValue>(() => ({
    mode: table.mode,
    config:
      table.mode === 'ratio'
        ? (table.config as unknown as RatioConfig)
        : ((table.config as unknown as TierConfig) ?? DEFAULT_TIER_CONFIG),
  }))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save() {
    setError(null)
    try {
      await update.mutateAsync({
        id: table.id,
        mode: value.mode,
        config: value.config,
      })
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ConversionFields
        initial={value}
        onChange={(v) => {
          setValue(v)
          setSaved(false)
        }}
      />
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="flex items-center gap-2">
        <Button type="button" onClick={save} disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save conversion'}
        </Button>
        {saved ? <FormMessage tone="success">Saved.</FormMessage> : null}
      </div>
    </div>
  )
}
