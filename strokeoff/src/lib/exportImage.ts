/**
 * Client-side PNG export for scorecards (spec §10). `html-to-image` is loaded on
 * demand so it stays out of the main bundle until someone exports a card.
 */
export async function exportNodeToPng(node: HTMLElement, filename: string) {
  const { toPng } = await import('html-to-image')
  const bg =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--color-bg')
      .trim() || '#ffffff'
  const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: bg })
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}

/**
 * Share a scorecard via the Web Share API (spec §10). Renders the node to a PNG
 * Blob (same html-to-image call as the download path) and hands it to the OS
 * share sheet as a file. Callers should feature-detect with `canShareFiles`
 * before offering this — `navigator.share` rejects with `AbortError` when the
 * user dismisses the sheet, which is a no-op, not a failure.
 */
export async function shareNodeAsPng(
  node: HTMLElement,
  filename: string,
  title?: string,
): Promise<void> {
  const { toBlob } = await import('html-to-image')
  const bg =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--color-bg')
      .trim() || '#ffffff'
  const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: bg })
  if (!blob) throw new Error('Could not render the scorecard image.')
  const file = new File([blob], filename, { type: 'image/png' })
  await navigator.share({ files: [file], title })
}

/** Whether the browser can share files via the Web Share API. */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined') return false
  if (typeof navigator.share !== 'function') return false
  if (typeof navigator.canShare !== 'function') return false
  const probe = new File([''], 'probe.png', { type: 'image/png' })
  return navigator.canShare({ files: [probe] })
}
