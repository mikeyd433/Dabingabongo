import { useEffect, useRef, useState } from 'react'
import { Button } from './Button'
import { FormMessage } from './FormMessage'

/**
 * Camera QR scanner (spec §3 — "Scan QR"). Opens the device camera in a
 * full-screen overlay and decodes QR codes with @zxing/browser, dynamically
 * imported so the decoder stays out of the main bundle (same pattern as the
 * html-to-image scorecard export). Calls `onResult` once with the decoded text,
 * then the caller closes it. Degrades to a clear message when there's no camera
 * or permission is denied — the manual code entry is always available behind it.
 *
 * The dark scrim + light text here are a deliberate exception to the token rule:
 * it's a camera viewfinder, which reads best on black regardless of theme.
 */
export function QrScanner({
  onResult,
  onClose,
  label = 'Point your camera at the QR code',
}: {
  onResult: (text: string) => void
  onClose: () => void
  label?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  // Keep the latest callback in a ref so the camera effect can run exactly once.
  // The caller typically passes an inline arrow (a new reference every render);
  // depending on it directly would tear down and re-init the camera on each
  // parent re-render, flickering the viewfinder and churning getUserMedia.
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  useEffect(() => {
    let stop: (() => void) | undefined
    let cancelled = false
    let handled = false

    void (async () => {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        const reader = new BrowserQRCodeReader()
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current ?? undefined,
          (result, _err, ctrl) => {
            if (handled || !result) return
            handled = true
            ctrl.stop()
            onResultRef.current(result.getText())
          },
        )
        if (cancelled) controls.stop()
        else stop = () => controls.stop()
      } catch {
        if (!cancelled) {
          setError(
            'Could not start the camera. Check permissions, or enter the code by hand.',
          )
        }
      }
    })()

    return () => {
      cancelled = true
      stop?.()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.92)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-label text-sm text-white">{label}</p>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
      <div className="mt-4 flex flex-1 items-center justify-center">
        {error ? (
          <div className="max-w-sm">
            <FormMessage tone="error">{error}</FormMessage>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="max-h-full w-full max-w-sm rounded-card object-cover"
            muted
            playsInline
          />
        )}
      </div>
    </div>
  )
}
