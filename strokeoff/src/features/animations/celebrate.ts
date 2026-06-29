import {
  isLottieAsset,
  resolveAnimation,
  type AnimationPreset,
  type ResolvedAnimation,
} from './types'

/**
 * Token-driven celebration engine (spec §12). `celebrate(config)` resolves a
 * rule's animation against the *active theme's* colors and runs a short effect
 * over the whole screen, cleaning itself up: Tier 1 canvas presets, a Tier 2
 * custom-image burst, or a Tier 3 full overlay (Lottie JSON / animated image).
 * Honors `prefers-reduced-motion` and the duration/particle caps, so it can never
 * jank the round. No-ops outside the browser.
 */
export function celebrate(raw: unknown): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return

  const cs = getComputedStyle(document.documentElement)
  const accent = cs.getPropertyValue('--color-accent').trim() || '#1d4ed8'
  const winner = cs.getPropertyValue('--color-winner').trim() || '#15803d'
  const anim = resolveAnimation(raw, { accent, winner })

  if (anim.preset === 'screen-flash') {
    runFlash(anim)
    return
  }
  // Tier 3 custom animation: a Lottie JSON or an animated image, centred overlay.
  if (anim.preset === 'custom-animation' && anim.assetUrl) {
    runCustomAnimation(anim, anim.assetUrl)
    return
  }
  // Tier 2 custom image: preload the particle, then burst it. If it fails to
  // load, fall back to confetti so a celebration still fires.
  if (anim.preset === 'image-burst' && anim.imageUrl) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => runParticles(anim, img)
    img.onerror = () =>
      runParticles({ ...anim, preset: 'confetti', imageUrl: null }, null)
    img.src = anim.imageUrl
    return
  }
  runParticles(anim, null)
}

/** Confetti fallback used when a custom asset can't render. */
function fallbackConfetti(anim: ResolvedAnimation) {
  runParticles(
    { ...anim, preset: 'confetti', assetUrl: null, durationMs: 1200 },
    null,
  )
}

/**
 * Tier 3 — play a full custom animation as a centred, pointer-transparent
 * overlay, removed after the (capped) duration. Lottie JSON renders via
 * lottie-web (dynamically imported so it stays out of the main bundle + offline
 * precache); anything else is treated as an animated image (GIF/WebP/APNG) the
 * browser plays natively. Any failure degrades to confetti.
 */
function runCustomAnimation(anim: ResolvedAnimation, url: string) {
  const host = document.createElement('div')
  overlayStyle(host)
  Object.assign(host.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  })
  document.body.appendChild(host)

  let done = false
  let destroy: (() => void) | undefined
  const cleanup = () => {
    if (done) return
    done = true
    destroy?.()
    host.remove()
  }
  const timer = window.setTimeout(cleanup, anim.durationMs)

  if (isLottieAsset(url)) {
    void import('lottie-web')
      .then(({ default: lottie }) => {
        if (done) return
        const box = document.createElement('div')
        Object.assign(box.style, {
          width: 'min(80vw, 80vh)',
          height: 'min(80vw, 80vh)',
        })
        host.appendChild(box)
        const player = lottie.loadAnimation({
          container: box,
          renderer: 'svg',
          loop: false,
          autoplay: true,
          path: url,
        })
        destroy = () => player.destroy()
        player.addEventListener('complete', () => {
          window.clearTimeout(timer)
          cleanup()
        })
      })
      .catch(() => {
        window.clearTimeout(timer)
        cleanup()
        fallbackConfetti(anim)
      })
    return
  }

  // Animated image (GIF/WebP/APNG): the browser animates it for us.
  const img = document.createElement('img')
  img.style.maxWidth = '80vw'
  img.style.maxHeight = '80vh'
  img.onerror = () => {
    window.clearTimeout(timer)
    cleanup()
    fallbackConfetti(anim)
  }
  img.src = url
  host.appendChild(img)
}

function overlayStyle(el: HTMLElement) {
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    zIndex: '9999',
    pointerEvents: 'none',
  })
}

function runFlash(anim: ResolvedAnimation) {
  const el = document.createElement('div')
  overlayStyle(el)
  el.style.background = anim.colors[0]
  document.body.appendChild(el)
  const fx = el.animate(
    [{ opacity: 0 }, { opacity: 0.35 }, { opacity: 0 }],
    { duration: anim.durationMs, easing: 'ease-out' },
  )
  fx.finished.then(() => el.remove()).catch(() => el.remove())
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  size: number
  color: string
  emoji: string | null
  image: HTMLImageElement | null
}

function rnd(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function initParticles(
  anim: ResolvedAnimation,
  width: number,
  height: number,
  image: HTMLImageElement | null,
): Particle[] {
  const { colors, emoji, particleCount, preset } = anim
  const pick = () => colors[Math.floor(Math.random() * colors.length)]
  const particles: Particle[] = []
  const falling = preset === 'confetti' || preset === 'raining-discs'
  const big = Boolean(emoji || image) // emoji/image particles read larger

  for (let i = 0; i < particleCount; i++) {
    if (falling) {
      particles.push({
        x: rnd(0, width),
        y: rnd(-height * 0.4, 0),
        vx: rnd(-1, 1),
        vy: rnd(1.5, 3.5),
        rot: rnd(0, Math.PI * 2),
        vr: rnd(-0.2, 0.2),
        size: big ? rnd(12, 20) : rnd(6, 12),
        color: pick(),
        emoji,
        image,
      })
    } else {
      // emoji-burst / image-burst / fireworks — radial burst from upper-centre
      const ang = rnd(0, Math.PI * 2)
      const spd = rnd(2, 7)
      particles.push({
        x: width / 2,
        y: height * 0.4,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 2,
        rot: rnd(0, Math.PI * 2),
        vr: rnd(-0.3, 0.3),
        size: big ? rnd(12, 22) : rnd(3, 6),
        color: pick(),
        emoji,
        image,
      })
    }
  }
  return particles
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  p: Particle,
  preset: AnimationPreset,
) {
  if (p.image) {
    const s = p.size * 2
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.drawImage(p.image, -s / 2, -s / 2, s, s)
    ctx.restore()
    return
  }
  if (p.emoji) {
    ctx.font = `${p.size * 2}px serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(p.emoji, p.x, p.y)
    return
  }
  if (preset === 'fireworks') {
    ctx.beginPath()
    ctx.fillStyle = p.color
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  // confetti rectangle
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.rot)
  ctx.fillStyle = p.color
  ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
  ctx.restore()
}

function runParticles(
  anim: ResolvedAnimation,
  image: HTMLImageElement | null,
) {
  const canvas = document.createElement('canvas')
  overlayStyle(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const width = window.innerWidth
  const height = window.innerHeight
  canvas.width = width * dpr
  canvas.height = height * dpr
  ctx.scale(dpr, dpr)
  document.body.appendChild(canvas)

  const particles = initParticles(anim, width, height, image)
  const start = performance.now()
  let raf = 0

  function frame(now: number) {
    const t = now - start
    if (t >= anim.durationMs || document.hidden) {
      cancelAnimationFrame(raf)
      canvas.remove()
      return
    }
    ctx!.clearRect(0, 0, width, height)
    ctx!.globalAlpha = Math.max(0, 1 - t / anim.durationMs)
    for (const p of particles) {
      p.vy += 0.15 // gravity
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      drawParticle(ctx!, p, anim.preset)
    }
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
}
