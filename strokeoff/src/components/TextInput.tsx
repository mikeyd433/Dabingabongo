import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

/** Token-driven text input. Colors/fonts come from the active theme. */
export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function TextInput({ className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`min-h-[44px] w-full rounded-card border border-border bg-surface px-3 py-2 font-label text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none ${className}`}
      {...props}
    />
  )
})
