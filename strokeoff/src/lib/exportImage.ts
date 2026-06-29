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
