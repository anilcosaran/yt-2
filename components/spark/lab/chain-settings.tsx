'use client'

import * as React from 'react'

import type { StageKind } from './lab-chain'
import './chain-settings.css'

// A node's detail settings ("Ayarlar") on Plan › Üretim: the sliders in a node's composer open them under the node, as
// list tiles: a picture's size, count, quality and look, a clip's length and camera, a voice's pace, and so on. Each is a
// few fixed choices; one that is only on or off is a switch. What is picked lives in the run's picks, by node
// (`settingKey`), so the panel keeps nothing of its own. See `plan-chain.tsx` for the node and its composer.

export type SettingRow = { id: string; label: string; options: string[]; def: string; hint?: string }

/** The two choices of a setting shown as a switch: off, then on. */
const OFF = 'Kapalı'
const ON = 'Açık'
const SIZES = ['9:16', '1:1', '16:9']

/** The detail settings of each kind of node, in order. */
export const NODE_SETTINGS: Partial<Record<StageKind, SettingRow[]>> = {
  image: [
    { id: 'aspect', label: 'Boyut', options: SIZES, def: '9:16' },
    { id: 'count', label: 'Adet', options: ['1', '2', '4'], def: '1' },
    { id: 'quality', label: 'Kalite', options: ['Taslak', 'Standart', 'Yüksek'], def: 'Standart' },
    { id: 'style', label: 'Stil', options: ['Doğal', 'Sinematik', 'Stüdyo'], def: 'Doğal' },
  ],
  video: [
    { id: 'aspect', label: 'Boyut', options: SIZES, def: '9:16' },
    { id: 'secs', label: 'Süre', options: ['5 sn', '8 sn', '10 sn'], def: '5 sn' },
    { id: 'camera', label: 'Kamera', options: ['Sabit', 'Yaklaş', 'Kaydır'], def: 'Yaklaş' },
    { id: 'sound', label: 'Ortam sesi', options: [OFF, ON], def: OFF },
  ],
  voice: [
    { id: 'speed', label: 'Hız', options: ['Yavaş', 'Normal', 'Hızlı'], def: 'Normal' },
    { id: 'mood', label: 'Duygu', options: ['Sakin', 'Sıcak', 'Enerjik'], def: 'Sıcak' },
  ],
  music: [
    { id: 'level', label: 'Seviye', options: ['Düşük', 'Orta'], def: 'Düşük' },
    { id: 'fade', label: 'Sonda kıs', options: [OFF, ON], def: ON },
  ],
  text: [
    { id: 'length', label: 'Uzunluk', options: ['Kısa', 'Orta', 'Uzun'], def: 'Kısa' },
    { id: 'tone', label: 'Ton', options: ['Samimi', 'Kurumsal', 'Esprili'], def: 'Samimi' },
  ],
}

/** The pick key of a row, for writing it (`run.pick(settingKey(id, row.id), value)`). */
export function settingKey(nodeId: string, rowId: string): string {
  return `set:${nodeId}:${rowId}`
}

/** A node's value for a row: kept in the run's picks under `set:<nodeId>:<rowId>`, else the row's default. */
export function settingOf(picks: Record<string, string | null>, nodeId: string, row: SettingRow): string {
  const value = picks[settingKey(nodeId, row.id)]
  // A pick the row no longer offers (its choices changed since) reads as the default.
  return value && row.options.includes(value) ? value : row.def
}

/** Whether a row is only on or off, and so a switch. */
const isSwitch = (row: SettingRow) => row.options.length === 2 && row.options[0] === OFF && row.options[1] === ON

/**
 * The panel under a node: one soft surface, a tile per setting with its name on the left and its choice on the right.
 * Escape or a press outside closes it; a press on an element marked `data-lb-ns-toggle` (the button that opens it) is
 * left to that button, so it can close the panel itself rather than close and reopen it.
 */
export function SettingsPanel({ rows, values, onChange, onClose }: {
  rows: SettingRow[]
  /** By row id. */
  values: Record<string, string>
  onChange: (rowId: string, value: string) => void
  onClose: () => void
}): React.JSX.Element {
  const box = React.useRef<HTMLDivElement>(null)
  const uid = React.useId()

  React.useEffect(() => {
    // Captured, so a press React Flow keeps to itself (on the pane, a node, a handle) still closes the panel.
    const away = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (box.current?.contains(target) || target.closest('[data-lb-ns-toggle]')) return
      onClose()
    }
    const esc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', away, true)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away, true)
      document.removeEventListener('keydown', esc)
    }
  }, [onClose])

  return (
    <div className="lb-ns nodrag nowheel" ref={box} role="group" aria-label="Ayarlar">
      {rows.map((row) => {
        const value = values[row.id] ?? row.def
        const labelId = `${uid}-${row.id}`
        return (
          <div key={row.id} className="lb-ns-row">
            <span id={labelId} className="lb-ns-label" title={row.hint}>{row.label}</span>
            {isSwitch(row) ? (
              <button
                type="button"
                role="switch"
                aria-checked={value === ON}
                aria-labelledby={labelId}
                className={`lb-ns-switch${value === ON ? ' on' : ''}`}
                onClick={() => onChange(row.id, value === ON ? OFF : ON)}
              />
            ) : (
              <span className="lb-ns-seg" role="group" aria-labelledby={labelId}>
                {row.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={option === value}
                    className={option === value ? 'on' : ''}
                    onClick={() => {
                      if (option !== value) onChange(row.id, option)
                    }}
                  >
                    {option}
                  </button>
                ))}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
