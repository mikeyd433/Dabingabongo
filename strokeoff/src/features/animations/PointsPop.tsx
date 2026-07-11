import { useEffect, useRef } from 'react'
import { POINTS_POP_MS, usePointsPops } from './pointsPop'

/**
 * The centered "+N" points pop (spec §12). Renders on top of the celebration
 * canvas as a large, theme-coloured number that scales in and fades out, so a
 * scorer sees exactly how many points just landed. Pointer-transparent and
 * aria-hidden (it's decorative — the feed carries the accessible record).
 * Honors prefers-reduced-motion by dropping the scale and just fading.
 */
export function PointsPop() {
  const pops = usePointsPops()
  if (pops.length === 0) return null
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center"
    >
      {pops.map((p) => (
        <PopNumber key={p.id} amount={p.amount} />
      ))}
    </div>
  )
}

function PopNumber({ amount }: { amount: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    )?.matches
    const frames: Keyframe[] = reduce
      ? [
          { opacity: 0 },
          { opacity: 1, offset: 0.12 },
          { opacity: 1, offset: 0.72 },
          { opacity: 0 },
        ]
      : [
          { opacity: 0, transform: 'scale(0.4)' },
          { opacity: 1, transform: 'scale(1.18)', offset: 0.22 },
          { opacity: 1, transform: 'scale(1)', offset: 0.6 },
          { opacity: 0, transform: 'scale(1.12)' },
        ]
    const anim = el.animate(frames, {
      duration: POINTS_POP_MS,
      easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
      fill: 'forwards',
    })
    return () => anim.cancel()
  }, [])

  return (
    <div
      ref={ref}
      className="absolute font-numeral font-bold leading-none"
      style={{
        // Big and centered; scales with the viewport so it reads on a phone.
        fontSize: 'clamp(4.5rem, 26vw, 11rem)',
        color: 'var(--color-accent)',
        // Theme-toned halo so the number stays legible over any celebration/bg.
        textShadow:
          '0 0 18px var(--color-surface), 0 0 6px var(--color-surface), 0 2px 2px var(--color-surface)',
        opacity: 0,
      }}
    >
      +{amount}
    </div>
  )
}
