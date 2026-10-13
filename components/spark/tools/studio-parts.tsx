import * as React from 'react'

/**
 * Small pieces of the Spark design shared by the shell and the tool drawers (design `sec()`, `tgl()`, `.empty`, the icon
 * sprite symbol). Moved out of `spark-editor-shell.tsx` unchanged so a tool file does not import the shell.
 */

/** One symbol of the studio icon sprite (`#i-<name>`). */
export function Icon({ name, size }: { name: string; size?: 'sm' }) {
  return (
    <svg className={`i${size ? ` ${size}` : ''}`} aria-hidden>
      <use href={`#i-${name}`} />
    </svg>
  )
}

/** Design `sec()`: one labelled section of the properties panel (`data` = `data-*` attributes a caller finds it by). */
export function PanelSection({ label, children, data }: { label: string; children: React.ReactNode; data?: Record<`data-${string}`, string> }) {
  return (
    <section className="pp-sec" {...data}>
      <div className="pp-label">{label}</div>
      {children}
    </section>
  )
}

/** Design `tgl()`: a labelled switch (`.sw-t`). */
export function Toggle({
  label,
  hint,
  on,
  disabled,
  title,
  onClick,
  style,
}: {
  label: string
  hint?: string
  on: boolean
  disabled: boolean
  title?: string
  onClick?: () => void
  style?: React.CSSProperties
}) {
  return (
    <div className="tgl" style={style}>
      <span>
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`sw-t${on ? ' on' : ''}`}
        disabled={disabled}
        title={title}
        onClick={onClick}
      />
    </div>
  )
}

export function EmptyNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <div className="big">
        <Icon name="sparkles" />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  )
}

/** m:ss (design `fmt`). */
export function formatSeconds(value: number) {
  const seconds = Math.max(0, value)
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export function formatDuration(seconds: number | null) {
  return seconds === null ? '—' : formatSeconds(seconds)
}
