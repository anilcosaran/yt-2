'use client'

import * as React from 'react'
import QRCode from 'qrcode'

export function RecordingQr({
  value,
  alt,
  size = 280,
}: {
  value: string
  alt: string
  size?: number
}) {
  const [dataUrl, setDataUrl] = React.useState('')

  React.useEffect(() => {
    if (!value) {
      setDataUrl('')
      return
    }
    let cancelled = false
    void QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#111111', light: '#ffffff' },
    }).then((url) => {
      if (!cancelled) setDataUrl(url)
    }).catch(() => {
      if (!cancelled) setDataUrl('')
    })
    return () => {
      cancelled = true
    }
  }, [size, value])

  if (!dataUrl) {
    return (
      <div
        className="rounded-2xl bg-white p-3"
        style={{ width: size, height: size }}
        aria-hidden
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      className="rounded-2xl bg-white p-3"
    />
  )
}
