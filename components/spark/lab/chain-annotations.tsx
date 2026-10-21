'use client'

import * as React from 'react'
import { NodeResizer, NodeToolbar, Position, type Node, type NodeProps } from '@xyflow/react'
import { Bold, Check, ChevronDown, Italic, PaintBucket, Strikethrough, Trash2, Underline, Ungroup } from 'lucide-react'

import { ColorButton, contrastText, normalizeHex, useDismiss } from './chain-color'
import './chain-annotations.css'

// Plan › Üretim's notes on its canvas (`plan-chain.tsx`), beside the nodes that make things: a frame that groups nodes
// (each scene of the video starts as one; the user can wrap a selection in one too), a sticky note and a free text (a
// heading or a line of description, without a box). None makes anything nor links to anything, so they have no ports. The canvas owns their data and moves a frame's nodes with it;
// these views only draw them and say what the user changed. A frame's name and a free text are set in a style of the
// user's (`TextStyle`: typeface, size, colours, emphasis), picked in their toolbars.

/**
 * The class of a frame's head (its name above the box). A frame moves by its head alone (React Flow's `dragHandle`);
 * its box lets every press through, so the canvas pans, selects and adds nodes inside it as if it were not there.
 */
export const FRAME_HANDLE = 'lb-an-frame-head'

/**
 * The named colours frames were saved with before any colour could be picked: a saved id still reads as its colour.
 * `none` is the canvas's own hairline.
 */
export const FRAME_COLORS = [
  { id: 'none', label: 'Renksiz', value: '' },
  { id: 'blue', label: 'Mavi', value: '#3b82f6' },
  { id: 'green', label: 'Yeşil', value: '#22a06b' },
  { id: 'yellow', label: 'Sarı', value: '#d9a106' },
  { id: 'orange', label: 'Turuncu', value: '#ea7a1f' },
  { id: 'pink', label: 'Pembe', value: '#e0457b' },
  { id: 'purple', label: 'Mor', value: '#8b5cf6' },
] as const

// ---- text style ------------------------------------------------------------------------------------------------

/** How a frame's name or a free text is set: its typeface, size, colours and emphasis. */
export type TextStyle = {
  font: 'sans' | 'serif' | 'mono' | 'display'
  /** In px. */
  size: number
  /** A hex colour, or null for the canvas's own text colour. */
  color: string | null
  /** A hex colour behind the text, or null for none (a free text only; a frame has its own colour). */
  background: string | null
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
}

/** A line of description: the app's typeface at 14px, nothing else. */
export const BODY_TEXT_STYLE: TextStyle = { font: 'sans', size: 14, color: null, background: null, bold: false, italic: false, underline: false, strike: false }
/** A heading: 22px, bold. */
export const TITLE_TEXT_STYLE: TextStyle = { ...BODY_TEXT_STYLE, size: 22, bold: true }
/** A frame's name as it has always been: small and bold. */
export const FRAME_TITLE_STYLE: TextStyle = { ...BODY_TEXT_STYLE, size: 13.5, bold: true }

/** The typefaces on offer: the app's own, and a serif, a monospace and a display face from the system. */
const FONTS: { id: TextStyle['font']; label: string; family: string }[] = [
  { id: 'sans', label: 'Sans', family: 'inherit' },
  { id: 'serif', label: 'Serif', family: "ui-serif, 'New York', 'Iowan Old Style', Georgia, Cambria, 'Times New Roman', serif" },
  { id: 'mono', label: 'Mono', family: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace" },
  { id: 'display', label: 'Display', family: "var(--st-font-display, 'SF Pro Display'), 'SF Pro Display', 'Inter Tight', system-ui, sans-serif" },
]

/** The sizes a free text and a frame's name are offered in. */
const LABEL_SIZES = [12, 14, 16, 20, 24, 32, 40]
const FRAME_TITLE_SIZES = [12, 13.5, 16, 20, 24]

/** A style as saved (`writeTextStyle`), over the defaults (`fallback` over `BODY_TEXT_STYLE`); what is missing or wrong in it reads as the default. */
export function readTextStyle(raw: string | null | undefined, fallback?: Partial<TextStyle>): TextStyle {
  const base: TextStyle = { ...BODY_TEXT_STYLE, ...fallback }
  let saved: Record<string, unknown> = {}
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed as Record<string, unknown>
  } catch {
    // A style that does not parse reads as the default.
  }
  const flag = (key: 'bold' | 'italic' | 'underline' | 'strike') => {
    const value = saved[key]
    return typeof value === 'boolean' ? value : base[key]
  }
  // A colour is a hex code or null (none); anything else (a name, a url) reads as the default.
  const color = (key: 'color' | 'background') => {
    const value = saved[key]
    if (value === null) return null
    return (typeof value === 'string' ? normalizeHex(value) : null) ?? base[key]
  }
  const font = FONTS.find((entry) => entry.id === saved.font)
  const size = saved.size
  return {
    font: font ? font.id : base.font,
    size: typeof size === 'number' && Number.isFinite(size) && size >= 6 && size <= 160 ? size : base.size,
    color: color('color'),
    background: color('background'),
    bold: flag('bold'),
    italic: flag('italic'),
    underline: flag('underline'),
    strike: flag('strike'),
  }
}

/** A style as it is saved (read back by `readTextStyle`). */
export function writeTextStyle(style: TextStyle): string {
  const { font, size, color, background, bold, italic, underline, strike } = style
  return JSON.stringify({ font, size, color, background, bold, italic, underline, strike })
}

/** The height of a line of text in a style, in px: a large size sets tighter. */
const lineOf = (style: TextStyle) => style.size * (style.size >= 20 ? 1.25 : 1.5)

/** A style as CSS for the text it sets (its background is left to the box around the text). */
export function textStyleCss(style: TextStyle): React.CSSProperties {
  const display = style.font === 'display'
  const decoration = [style.underline ? 'underline' : '', style.strike ? 'line-through' : ''].filter(Boolean).join(' ')
  return {
    fontFamily: FONTS.find((entry) => entry.id === style.font)?.family ?? 'inherit',
    fontSize: style.size,
    // The display face sits a step heavier than the rest, bold or not.
    fontWeight: style.bold ? (display ? 700 : 600) : display ? 500 : 400,
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: decoration || 'none',
    color: normalizeHex(style.color) ?? undefined,
    lineHeight: style.size >= 20 ? 1.25 : 1.5,
    letterSpacing: display || style.size >= 20 ? '-0.01em' : undefined,
  }
}

// ---- data ------------------------------------------------------------------------------------------------------

export type FrameData = {
  title: string
  /** 'none' or any CSS hex colour; old saved ids from FRAME_COLORS ('blue', …) must still render as their colour. */
  color: string
  titleStyle: TextStyle
  onTitle: (title: string) => void
  onColor: (color: string) => void
  onTitleStyle: (style: TextStyle) => void
  /** Removes the frame only; the nodes in it stay. */
  onRemove: () => void
}
export type FrameNode = Node<FrameData, 'frame'>

export type NoteData = { text: string; onText: (text: string) => void; onRemove: () => void }
export type NoteNode = Node<NoteData, 'note'>

/** A free text on the canvas: a heading, or a line of description, in a style of the user's. */
export type LabelData = { text: string; style: TextStyle; onText: (text: string) => void; onStyle: (style: TextStyle) => void; onRemove: () => void }
export type LabelNode = Node<LabelData, 'label'>

/** Puts the caret in a field as it appears, without scrolling the canvas's frame, its text selected. */
function focusAndSelect(field: HTMLInputElement | null) {
  if (!field) return
  field.focus({ preventScroll: true })
  field.select()
}

/** Puts the caret in a field as it appears, without scrolling the canvas's frame. */
function focusQuietly(field: HTMLTextAreaElement | null) {
  field?.focus({ preventScroll: true })
}

// ---- frame ----------------------------------------------------------------------------------------------------

/**
 * The stacking of a frame's toolbar. A frame lies under every other node (its zIndex is far below zero) and React Flow
 * stacks a node's toolbar just over its node, which put the frame's under the canvas's own pane, seen but out of reach
 * of the pointer; it is lifted to where a selected node's toolbar sits.
 */
const FRAME_TOOLBAR_Z = 1001

/** A frame's colour as CSS: a hex code, or one of the named colours frames were once saved with; null for none. */
function frameTint(color: string): string | null {
  return FRAME_COLORS.find((entry) => entry.id === color)?.value || normalizeHex(color)
}

/**
 * A group of nodes: a soft rounded box, in a colour of the user's if they gave it one, its name above it in a style of
 * theirs. Any edge or corner resizes it at any time (the corners show while it is selected); its name moves it.
 */
export function FrameNodeView({ data, selected }: NodeProps<FrameNode>) {
  const [editing, setEditing] = React.useState(false)
  const tint = frameTint(data.color)
  const titleCss = textStyleCss(data.titleStyle)
  return (
    <div
      className={`lb-an-frame${selected ? ' selected' : ''}${tint ? ' tinted' : ''}`}
      style={tint ? ({ '--fc': tint } as React.CSSProperties) : undefined}
    >
      <NodeResizer isVisible minWidth={260} minHeight={180} handleClassName="lb-an-handle" lineClassName="lb-an-line" />
      <div className={FRAME_HANDLE}>
        {tint ? <i className="lb-an-frame-dot" aria-hidden /> : null}
        {editing ? (
          <FrameField
            className="lb-an-frame-t"
            style={titleCss}
            value={data.title}
            placeholder="Çerçeve adı"
            label="Çerçeve adı"
            onKeep={(text) => {
              // A frame always keeps a name: its head is what moves it.
              if (text && text !== data.title) data.onTitle(text)
            }}
            onClose={() => setEditing(false)}
          />
        ) : (
          <span className="lb-an-frame-t" style={titleCss} onDoubleClick={() => setEditing(true)} title="Adını değiştirmek için çift tıkla">{data.title || 'Çerçeve'}</span>
        )}
      </div>
      {/* Above the name, whatever its size: the name sits 8px over the box, the toolbar 12px over the name. */}
      <NodeToolbar
        position={Position.Top}
        offset={20 + Math.round(lineOf(data.titleStyle))}
        align="start"
        className="lb-cv-bar"
        style={{ zIndex: FRAME_TOOLBAR_Z }}
      >
        <ColorButton value={tint} onChange={(color) => data.onColor(color ?? 'none')} label="Çerçevenin rengi" allowNone />
        <i className="lb-an-sep" aria-hidden />
        <TextControls style={data.titleStyle} onStyle={data.onTitleStyle} sizes={FRAME_TITLE_SIZES} />
        <i className="lb-an-sep" aria-hidden />
        <button type="button" className="lb-an-icon" onClick={data.onRemove} title="Çerçeveyi kaldır: içindeki düğümler yerinde kalır" aria-label="Çerçeveyi kaldır">
          <Ungroup aria-hidden />
        </button>
      </NodeToolbar>
    </div>
  )
}

/** A frame's name, edited in place: Enter or a click away keeps it (trimmed), Escape leaves it as it was. */
function FrameField({ className, style, value, placeholder, label, onKeep, onClose }: {
  className: string
  style: React.CSSProperties
  value: string
  placeholder: string
  label: string
  onKeep: (text: string) => void
  onClose: () => void
}) {
  const [text, setText] = React.useState(value)
  const cancelled = React.useRef(false)
  return (
    <input
      ref={focusAndSelect}
      className={`${className} lb-an-frame-in nodrag`}
      style={style}
      value={text}
      size={Math.max(text.length + 1, 8)}
      placeholder={placeholder}
      aria-label={label}
      spellCheck={false}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        if (!cancelled.current) onKeep(text.trim())
        onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur()
        if (event.key === 'Escape') {
          cancelled.current = true
          event.currentTarget.blur()
        }
      }}
    />
  )
}

// ---- note -----------------------------------------------------------------------------------------------------

/** A sticky note: warm paper with the user's words; it drags from anywhere until selected, then it is written in. */
export function NoteNodeView({ data, selected }: NodeProps<NoteNode>) {
  return (
    <div className={`lb-an-note${selected ? ' selected' : ''}`}>
      {selected ? (
        <GrowField value={data.text} onText={data.onText} placeholder="Not yaz…" label="Not" />
      ) : (
        <div className="lb-an-note-field" data-value={data.text}>
          <p className={data.text ? undefined : 'empty'}>{data.text || 'Not yaz…'}</p>
        </div>
      )}
      <NodeToolbar position={Position.Top} offset={12} align="end" className="lb-cv-bar">
        <button type="button" className="lb-an-icon" onClick={data.onRemove} title="Notu sil" aria-label="Notu sil">
          <Trash2 aria-hidden />
        </button>
      </NodeToolbar>
    </div>
  )
}

// ---- free text ------------------------------------------------------------------------------------------------

/** The two presets of a free text: each sets its size and weight, and leaves the rest of its style as it is. */
const PRESETS = [
  { id: 'title', label: 'Başlık', style: TITLE_TEXT_STYLE },
  { id: 'body', label: 'Metin', style: BODY_TEXT_STYLE },
] as const

/**
 * A heading or a line of description, straight on the canvas, in a style of the user's (on a soft rounded background
 * if they gave it one): it drags from anywhere until selected, then it is written in.
 */
export function LabelNodeView({ data, selected }: NodeProps<LabelNode>) {
  const { style } = data
  const heading = style.size >= 20
  const placeholder = heading ? 'Başlık yaz…' : 'Açıklama yaz…'
  const background = normalizeHex(style.background)
  // Without a colour of its own, a text on a background takes whichever of dark or light reads on it.
  const textCss = { ...textStyleCss(style), color: normalizeHex(style.color) ?? (background ? contrastText(background) : undefined) }
  return (
    <div
      className={`lb-an-label${heading || style.bold ? ' strong' : ''}${selected ? ' selected' : ''}`}
      style={background ? { background } : undefined}
    >
      {selected ? (
        <GrowField value={data.text} onText={data.onText} placeholder={placeholder} label="Yazı" style={textCss} />
      ) : (
        <div className="lb-an-note-field" data-value={data.text} style={textCss}>
          <p className={data.text ? undefined : 'empty'}>{data.text || placeholder}</p>
        </div>
      )}
      <NodeToolbar position={Position.Top} offset={10} align="start" className="lb-cv-bar">
        {PRESETS.map((preset) => {
          const on = style.size === preset.style.size && style.bold === preset.style.bold
          return (
            <button
              key={preset.id}
              type="button"
              className={on ? 'on' : ''}
              aria-pressed={on}
              onClick={() => data.onStyle({ ...style, size: preset.style.size, bold: preset.style.bold })}
            >
              {preset.label}
            </button>
          )
        })}
        <i className="lb-an-sep" aria-hidden />
        <TextControls style={style} onStyle={data.onStyle} sizes={LABEL_SIZES} background />
        <i className="lb-an-sep" aria-hidden />
        <button type="button" className="lb-an-icon" onClick={data.onRemove} title="Yazıyı sil" aria-label="Yazıyı sil">
          <Trash2 aria-hidden />
        </button>
      </NodeToolbar>
    </div>
  )
}

/**
 * A selected note's (or free text's) words as a field that grows with them (a hidden copy of the text sizes it where
 * `field-sizing` is missing). It keeps what was typed when it is left; Escape leaves it too. A brand-new, empty one
 * takes the caret. A free text's style is set on the field's box, so the field and its hidden copy both take it.
 */
function GrowField({ value, onText, placeholder, label, style }: {
  value: string
  onText: (text: string) => void
  placeholder: string
  label: string
  style?: React.CSSProperties
}) {
  const [draft, setDraft] = React.useState<string | null>(null)
  // Whether the note was empty when it was selected, fixed for as long as it stays selected (so emptying it later
  // does not pull the caret back).
  const [fresh] = React.useState(() => !value)
  const text = draft ?? value
  return (
    <div className="lb-an-note-field" data-value={text} style={style}>
      <textarea
        ref={fresh ? focusQuietly : undefined}
        className="nodrag nowheel"
        rows={1}
        value={text}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== null && draft !== value) onText(draft)
          setDraft(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.currentTarget.blur()
        }}
      />
    </div>
  )
}

// ---- text toolbar ---------------------------------------------------------------------------------------------

/** The emphasis toggles, in the order a text editor shows them. */
const MARKS = [
  { key: 'bold', label: 'Kalın', Icon: Bold },
  { key: 'italic', label: 'İtalik', Icon: Italic },
  { key: 'underline', label: 'Altı çizili', Icon: Underline },
  { key: 'strike', label: 'Üstü çizili', Icon: Strikethrough },
] as const

/**
 * The text controls a frame's toolbar and a free text's share: typeface and size menus, the text's colour (and its
 * background, for a free text), then bold, italic, underline and strikethrough. Each change hands back the whole style.
 */
function TextControls({ style, onStyle, sizes, background = false }: {
  style: TextStyle
  onStyle: (style: TextStyle) => void
  sizes: number[]
  background?: boolean
}) {
  const font = FONTS.find((entry) => entry.id === style.font) ?? FONTS[0]
  return (
    <>
      <ToolbarMenu
        label="Yazı tipi"
        value={style.font}
        options={FONTS.map((entry) => ({ id: entry.id, label: entry.label, style: { fontFamily: entry.family } }))}
        onPick={(id) => onStyle({ ...style, font: id })}
      >
        <span className="lb-an-face" style={{ fontFamily: font.family }}>Aa</span>
      </ToolbarMenu>
      <ToolbarMenu label="Yazı boyutu" value={style.size} options={sizes.map((size) => ({ id: size, label: String(size) }))} onPick={(size) => onStyle({ ...style, size })}>
        <span className="lb-an-face num">{style.size}</span>
      </ToolbarMenu>
      <ColorButton
        value={style.color}
        onChange={(color) => onStyle({ ...style, color })}
        label="Yazı rengi"
        allowNone
        noneLabel="Varsayılan"
        icon={<span className="lb-an-glyph" aria-hidden>A</span>}
      />
      {background ? (
        <ColorButton value={style.background} onChange={(color) => onStyle({ ...style, background: color })} label="Arka plan rengi" allowNone icon={<PaintBucket aria-hidden />} />
      ) : null}
      <i className="lb-an-sep" aria-hidden />
      {MARKS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          className={`lb-an-icon${style[key] ? ' on' : ''}`}
          aria-pressed={style[key]}
          title={label}
          aria-label={label}
          onClick={() => onStyle({ ...style, [key]: !style[key] })}
        >
          <Icon aria-hidden />
        </button>
      ))}
    </>
  )
}

/**
 * A small menu in a toolbar: a button showing the current choice (`children`) and a list under it, on the colour
 * picker's surface. A pick closes it, as do Escape and a press outside.
 */
function ToolbarMenu<T extends string | number>({ label, value, options, onPick, children }: {
  label: string
  value: T
  options: { id: T; label: string; style?: React.CSSProperties }[]
  onPick: (id: T) => void
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const box = React.useRef<HTMLSpanElement>(null)
  const close = () => setOpen(false)
  useDismiss(open, box, close)
  return (
    <span ref={box} className="lb-cc">
      <button
        type="button"
        className={`lb-an-drop${open ? ' on' : ''}`}
        title={label}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {children}
        <ChevronDown className="lb-an-chev" aria-hidden />
      </button>
      {open ? (
        <div className="lb-cc-pop lb-an-menu nodrag nopan nowheel nokey" role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === value}
              className={`lb-an-opt${option.id === value ? ' on' : ''}`}
              style={option.style}
              onClick={() => {
                if (option.id !== value) onPick(option.id)
                close()
              }}
            >
              {option.label}
              {option.id === value ? <Check aria-hidden /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  )
}
