import { TextInput } from '@/components/TextInput'

/** Labelled form row shared by the course and layout editors. */
export function Field({
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

/**
 * Numeric field that keeps "unknown" distinct from zero — a blank par means
 * nobody has sourced one, which is not the same as a par of 0.
 */
export function NumberField({
  label,
  htmlFor,
  hint,
  className = '',
  value,
  onChange,
  placeholder,
}: {
  label: string
  htmlFor: string
  hint?: string
  className?: string
  value: number | null
  onChange: (value: number | null) => void
  placeholder?: string
}) {
  return (
    <Field label={label} htmlFor={htmlFor} hint={hint} className={className}>
      <TextInput
        id={htmlFor}
        type="number"
        inputMode="numeric"
        value={value == null ? '' : String(value)}
        placeholder={placeholder ?? 'Not set'}
        onChange={(e) =>
          onChange(e.target.value === '' ? null : Number(e.target.value))
        }
      />
    </Field>
  )
}
