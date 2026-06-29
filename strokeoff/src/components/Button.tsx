import type { ButtonHTMLAttributes, MouseEvent } from 'react'
import { haptic as fireHaptic, type HapticKind } from '@/lib/haptics'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  /**
   * Haptic pulse on press. Defaults to a light tap for primary actions and none
   * for secondary; pass a kind to override (e.g. "success") or `false` to mute.
   */
  haptic?: HapticKind | false
}

/**
 * Token-driven button primitive. Primary uses the theme accent; secondary is a
 * bordered surface. No hardcoded colors — restyles automatically with the theme.
 * Fires a light haptic on primary presses (progressive enhancement, see lib/haptics).
 */
export function Button({
  variant = 'primary',
  haptic,
  className = '',
  onClick,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex min-h-[44px] items-center justify-center rounded-card px-5 py-2.5 font-label text-sm font-semibold transition-opacity disabled:opacity-50'
  const styles =
    variant === 'primary'
      ? 'bg-accent text-accent-contrast hover:opacity-90'
      : 'border border-border bg-surface text-text hover:opacity-90'

  const kind: HapticKind | false =
    haptic === undefined ? (variant === 'primary' ? 'light' : false) : haptic

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (kind && !props.disabled) fireHaptic(kind)
    onClick?.(e)
  }

  return (
    <button
      className={`${base} ${styles} ${className}`}
      onClick={handleClick}
      {...props}
    />
  )
}
