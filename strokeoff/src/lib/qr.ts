/**
 * Pull a join code out of a scanned QR. Round/group QRs encode a full app URL
 * with a `join` query param; anything else is treated as a raw code.
 */
export function joinCodeFromScan(text: string): string {
  const trimmed = text.trim()
  try {
    const url = new URL(trimmed)
    const join = url.searchParams.get('join')
    if (join) return join
  } catch {
    // Not a URL — fall through and treat the text itself as the code.
  }
  return trimmed
}
