import type { SelectHTMLAttributes } from 'react'

/** Token-driven select. Colors/fonts come from the active theme. */
export function Select({
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`min-h-[44px] rounded-card border border-border bg-surface px-3 py-2 font-label text-sm text-text focus:border-accent focus:outline-none ${className}`}
      {...props}
    />
  )
}
