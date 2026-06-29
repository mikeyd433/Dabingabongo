interface FormMessageProps {
  tone?: 'error' | 'success' | 'muted'
  children: React.ReactNode
}

/** Small inline form feedback line. Token-driven colors. */
export function FormMessage({ tone = 'muted', children }: FormMessageProps) {
  const color =
    tone === 'error'
      ? 'var(--color-accent)'
      : tone === 'success'
        ? 'var(--color-winner)'
        : 'var(--color-muted)'
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className="font-label text-xs"
      style={{ color }}
    >
      {children}
    </p>
  )
}
