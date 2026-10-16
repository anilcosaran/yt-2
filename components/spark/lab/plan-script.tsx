'use client'

import * as React from 'react'

import {
  BRIEF,
  CONTEXT,
  LOOK_OPTIONS,
  SKILL,
  TOTAL_SECONDS,
  VOICE_TRAITS,
  formatClock,
  type ContextGroup,
  type ContextRow,
  type LabScene,
  type LookOption,
} from './lab-model'
import { EditableText } from './lab-edit'
import { NoteToolbar, NotesBar } from './lab-notes'
import { FrameSlot, SourcePicker } from './lab-source'
import { FormatPicker, Icon, LockButton, SceneDot, SceneThumb, presenceOf } from './lab-parts'
import { applyingTo, assumptionsOf, notesOn, pickOf, revealed, sayOf, type AddedScene, type LabRun } from './use-lab-run'

// Plan view, "Senaryo": the plan in full, as a document with a section menu.
//
// The menu on the left names the parts and shows how much is in each; it follows the scroll and jumps to a part.
// Each part is a heading over a rule, then open rows, and the way to add to it as the last row: it opens into a
// row to fill in, right where the new row will be. What the video is: the brief, the script, the cast and look.
// What it drew on: the channel's rules, knowledge and skill. What the agent decided by itself: the assumptions.
//
// A text is rewritten from its pencil (`EditableText`), not by clicking on it. A choice (the character, the voice,
// the kit, the caption style, the music) is shown as what was chosen and opens into the things to choose from.
//
// Where a row came from is said once, by its part (the heading's line), not on every row. A row is marked only
// when it differs from its part: a choice that holds for this video alone, with the way to keep it.

type SectionId = 'brief' | 'script' | 'look' | 'rules' | 'knowledge' | 'skill' | 'assumptions'

const MENU: { group: string; items: { id: SectionId; label: string }[] }[] = [
  {
    group: 'Plan',
    items: [
      { id: 'brief', label: 'Brief' },
      { id: 'script', label: 'Senaryo' },
      { id: 'look', label: 'Karakter ve görünüm' },
    ],
  },
  {
    group: 'Bellek',
    items: [
      { id: 'rules', label: 'Kurallar' },
      { id: 'knowledge', label: 'Bilgi' },
      { id: 'skill', label: 'Yetenek' },
    ],
  },
  { group: 'Kararlar', items: [{ id: 'assumptions', label: 'Varsayımlar' }] },
]

export function PlanScript({ run, scenes }: { run: LabRun; scenes: LabScene[] }) {
  const { state } = run
  const doc = React.useRef<HTMLDivElement>(null)
  const [active, setActive] = React.useState<SectionId>('brief')
  // One choice is open at a time.
  const [choosing, setChoosing] = React.useState<string | null>(null)
  // Scenes picked for a note; the toolbar opens under the one picked last.
  const [picked, setPicked] = React.useState<string[]>([])
  const [anchor, setAnchor] = React.useState<string | null>(null)
  const [focusSignal, setFocusSignal] = React.useState(0)
  const pickScene = (id: string, add: boolean, focus: boolean) => {
    const next = add ? (picked.includes(id) ? picked.filter((entry) => entry !== id) : [...picked, id]) : [id]
    setPicked(next)
    setAnchor(next.includes(id) ? id : (next[next.length - 1] ?? null))
    if (focus) setFocusSignal((count) => count + 1)
  }
  const closePick = React.useCallback(() => {
    setPicked([])
    setAnchor(null)
  }, [])
  // Every row that can be picked, in order, by the name the user sees.
  const pickable = [
    ...scenes.map((scene) => ({ id: scene.id, role: scene.role })),
    ...state.added.scenes.map((scene) => ({ id: scene.id, role: addedRole(state, scene) || 'Yeni sahne' })),
  ]
  const pickedRows = pickable.filter((row) => picked.includes(row.id))
  const toolbarOn = (id: string) =>
    anchor === id && pickedRows.length ? (
      <NoteToolbar
        run={run}
        selection={{ targets: pickedRows.map((row) => row.id), labels: pickedRows.map((row) => row.role), noun: 'sahne' }}
        onClose={closePick}
        focusSignal={focusSignal}
        keep=".lb-sel, .lb-fix, .lb-note-chip"
        className="inline"
      />
    ) : null

  const written = <T extends { at: number }>(items: T[]) => items.filter((item) => revealed(state, item.at))
  const rows = (group: ContextGroup) => written(CONTEXT.filter((row) => row.group === group))
  const brief = written(BRIEF)
  const rules = rows('rules')
  const knowledge = rows('knowledge')
  const assumptions = assumptionsOf(state)
  const skill = revealed(state, SKILL.at)
  const { added } = state
  const count: Record<SectionId, number> = {
    brief: brief.length,
    script: scenes.length + (scenes.length ? added.scenes.length : 0),
    look: rows('look').length,
    rules: rules.length + (rules.length ? added.rules.length : 0),
    knowledge: knowledge.length + (knowledge.length ? added.knowledge.length : 0),
    skill: skill ? 1 : 0,
    assumptions: assumptions.length,
  }
  const fromChannel = brief.filter((field) => field.source === 'channel').map((field) => field.label.toLocaleLowerCase('tr'))
  // A rule kept for the channel counts as the channel's from then on; one the user wrote is this video's.
  const ownRules = rules.filter((row) => row.source !== 'channel' && !state.promoted.includes(row.id)).length + added.rules.length
  const seconds = TOTAL_SECONDS + added.scenes.reduce((sum, scene) => sum + scene.seconds, 0)

  // The menu marks the part that is at the top of the page.
  const onScroll = () => {
    const root = doc.current
    if (!root) return
    const line = root.getBoundingClientRect().top + 96
    let current: SectionId = 'brief'
    root.querySelectorAll<HTMLElement>('[data-plan-section]').forEach((section) => {
      if (section.getBoundingClientRect().top <= line) current = section.dataset.planSection as SectionId
    })
    setActive(current)
  }
  const go = (id: SectionId) => doc.current?.querySelector(`[data-plan-section="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className={`lb-b-board lb-script${picked.length ? ' picking' : ''}`}>
      <nav className="lb-nav" aria-label="Plan bölümleri">
        {MENU.map((group) => (
          <div key={group.group} className="lb-nav-group">
            <span className="lb-nav-h">{group.group}</span>
            {group.items.map((item) => (
              <button key={item.id} type="button" className={`${item.id === active ? 'on' : ''}${count[item.id] ? '' : ' pending'}`} onClick={() => go(item.id)}>
                <span>{item.label}</span>
                {count[item.id] ? <small>{count[item.id]}</small> : null}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="lb-plan-doc" ref={doc} onScroll={onScroll}>
        <div className="lb-plan-in">
          {brief.length ? (
            <Section id="brief" title="Brief" meta={fromChannel.length ? `${fromChannel.join(' ve ')} kanal belleğinden` : undefined}>
              {brief.map((field) => (
                <div key={field.id} className="lb-tr lb-in">
                  <span className="lb-th">{field.label}</span>
                  <div className="lb-td">
                    {field.id === 'format' ? (
                      <FormatPicker run={run} />
                    ) : (
                      <EditableText label={field.label} value={state.edits[field.id] ?? field.value} onChange={(text) => run.edit(field.id, text)} />
                    )}
                  </div>
                </div>
              ))}
            </Section>
          ) : null}

          {scenes.length ? (
            <Section id="script" title="Senaryo" meta={`${count.script} sahne · ${formatClock(seconds)}`}>
              <div className="lb-tr scene head">
                <span className="lb-th">#</span>
                <span className="lb-th">Süre</span>
                <span className="lb-th">Kare</span>
                <span className="lb-th">Anlatım ve ekran metni</span>
                <span className="lb-th">Kullandıkları</span>
                <span />
              </div>
              {scenes.map((scene) => (
                <SceneRow
                  key={scene.id}
                  scene={scene}
                  run={run}
                  picked={picked.includes(scene.id)}
                  onPick={pickScene}
                  toolbar={toolbarOn(scene.id)}
                />
              ))}
              {added.scenes.map((scene, index) => (
                <AddedSceneRow
                  key={scene.id}
                  scene={scene}
                  run={run}
                  n={scenes.length + index + 1}
                  start={TOTAL_SECONDS + added.scenes.slice(0, index).reduce((sum, entry) => sum + entry.seconds, 0)}
                  picked={picked.includes(scene.id)}
                  onPick={pickScene}
                  toolbar={toolbarOn(scene.id)}
                  onRemove={() => {
                    if (picked.includes(scene.id)) closePick()
                    run.removeAdded('scenes', index)
                  }}
                />
              ))}
              {state.phase === 'drafting' ? (
                <div className="lb-add" aria-hidden><span className="spin" />Sahneler yazılıyor…</div>
              ) : (
                <button type="button" className="lb-add" onClick={() => run.addScene({ role: '', say: '', seconds: 4 })}>
                  <i><Icon name="plus" size="sm" /></i>
                  Sahne ekle
                </button>
              )}
            </Section>
          ) : null}

          {count.look ? (
            <Section id="look" title="Karakter ve görünüm" meta="kim konuşuyor, nasıl görünüyor">
              {rows('look').map((row) => (
                <LookRow key={row.id} row={row} run={run} open={choosing === row.id} onToggle={() => setChoosing(choosing === row.id ? null : row.id)} />
              ))}
            </Section>
          ) : null}

          {count.rules ? (
            <Section id="rules" title="Kurallar" meta={`${count.rules - ownRules} kanal kuralı${ownRules ? ` · ${ownRules} bu videoya özel` : ''}`}>
              {rules.map((row) => (
                <div key={row.id} className="lb-tr wide lb-in">
                  <div className="lb-td">
                    <b>{row.title}</b>
                    <small>{[row.value, row.usedIn, thisVideoOnly(row, run)].filter(Boolean).join(' · ')}</small>
                  </div>
                  <div className="lb-tr-acts"><Keep row={row} run={run} /></div>
                </div>
              ))}
              {added.rules.map((text, index) => (
                <OwnRow key={`${index}:${text}`} text={text} note="Sen ekledin · yalnız bu video için" onRemove={() => run.removeAdded('rules', index)} />
              ))}
              <AddRow label="Kural ekle" placeholder="Kuralı yaz: “Fiyatı her zaman sonda göster.”" onAdd={(text) => run.add('rules', text)} />
            </Section>
          ) : null}

          {count.knowledge ? (
            <Section id="knowledge" title="Bilgi" meta="kanal belleğinden, bu videoda kullanılanlar">
              {knowledge.map((row) => (
                <div key={row.id} className="lb-tr wide lb-in">
                  <div className="lb-td">
                    <b>{row.title}</b>
                    <small>{[row.value, row.usedIn].filter(Boolean).join(' · ')}</small>
                  </div>
                </div>
              ))}
              {added.knowledge.map((text, index) => (
                <OwnRow key={`${index}:${text}`} text={text} note="Sen ekledin · Spark bu videoda kullanır" onRemove={() => run.removeAdded('knowledge', index)} />
              ))}
              <AddRow label="Bilgi ekle" placeholder="Bilgiyi yaz ya da bir bağlantı yapıştır" onAdd={(text) => run.add('knowledge', text)} />
            </Section>
          ) : null}

          {skill ? (
            <Section id="skill" title="Yetenek" meta="Spark’ın bu işi yürüttüğü yöntem">
              <div className="lb-tr wide lb-in">
                <div className="lb-td">
                  <b>{SKILL.name}</b>
                  <small>Ürünün fiyatını menüden alır, marka sesiyle iki cümle yazar, kapanışta adres ve saatleri gösterir.</small>
                </div>
                <div className="lb-tr-acts"><button type="button" className="lb-act">Değiştir</button></div>
              </div>
            </Section>
          ) : null}

          {assumptions.length ? (
            <Section id="assumptions" title="Varsayımlar" meta="Spark’ın sana sormadan verdiği kararlar">
              {assumptions.map((item) => {
                const dropped = state.dropped.includes(item.id)
                return (
                  <div key={item.id} className={`lb-tr wide lb-in${dropped ? ' dropped' : ''}`}>
                    <div className="lb-td">{item.text}</div>
                    <div className="lb-tr-acts">
                      <button type="button" className="lb-act" onClick={() => run.dropAssumption(item.id)}>{dropped ? 'Geri getir' : 'Geri al'}</button>
                    </div>
                  </div>
                )
              })}
            </Section>
          ) : null}
        </div>
        <NotesBar run={run} variant="float" />
      </div>
    </div>
  )
}

/** One part of the plan: a heading over a rule (with one line on what the part holds), then its rows. */
function Section({ id, title, meta, children }: { id: SectionId; title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="lb-sec" data-plan-section={id}>
      <header>
        <h3>{title}</h3>
        {meta ? <small>{meta}</small> : null}
      </header>
      <div className="lb-table">{children}</div>
    </section>
  )
}

// ---- adding to a part ----------------------------------------------------------------------------------------

/** Adding to a part is its last row. It opens into a row to fill in, right where the new row will be. */
function AddRow({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd: (text: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState('')
  const close = () => {
    setOpen(false)
    setText('')
  }
  if (!open) {
    return (
      <button type="button" className="lb-add" onClick={() => setOpen(true)}>
        <i><Icon name="plus" size="sm" /></i>
        {label}
      </button>
    )
  }
  return (
    <form
      className="lb-draft"
      onSubmit={(event) => {
        event.preventDefault()
        if (text.trim()) onAdd(text.trim())
        close()
      }}
    >
      <input autoFocus value={text} placeholder={placeholder} aria-label={label} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.key === 'Escape' && close()} />
      <button type="submit" className="btn sm primary" disabled={!text.trim()}>Ekle</button>
      <button type="button" className="lb-act" onClick={close}>Vazgeç</button>
    </form>
  )
}

/** A rule or a piece of knowledge the user wrote into this plan. */
function OwnRow({ text, note, onRemove }: { text: string; note: string; onRemove: () => void }) {
  return (
    <div className="lb-tr wide lb-in">
      <div className="lb-td">
        <b>{text}</b>
        <small>{note}</small>
      </div>
      <div className="lb-tr-acts"><button type="button" className="lb-act" onClick={onRemove}>Kaldır</button></div>
    </div>
  )
}

/** The name of a scene the user added, as they last wrote it. */
function addedRole(state: LabRun['state'], scene: AddedScene) {
  return state.edits[`role:${scene.id}`] ?? scene.role
}

/**
 * A scene the user added. "Sahne ekle" puts it in the script at once with its name open for typing; Enter moves on to
 * its line. From then on it works like a planned one: picked, its name and line rewritten in place, its source and
 * model chosen, a note for Spark. Spark plans its frame and screen text; until then it has no picture.
 */
function AddedSceneRow({
  scene,
  run,
  n,
  start,
  picked,
  onPick,
  toolbar,
  onRemove,
}: {
  scene: AddedScene
  run: LabRun
  n: number
  start: number
  picked: boolean
  onPick: (id: string, add: boolean, focus: boolean) => void
  toolbar: React.ReactNode
  onRemove: () => void
}) {
  const role = addedRole(run.state, scene)
  // A scene that has no name yet was just added: its name opens for typing, then its line.
  const [writing, setWriting] = React.useState<'role' | 'say' | null>(() => (role ? null : 'role'))
  const note = notesOn(run.state, scene.id).find((entry) => entry.kind !== 'source') ?? null
  const remaking = applyingTo(run.state, scene.id)
  const several = (event: React.MouseEvent) => event.shiftKey || event.metaKey || event.ctrlKey
  return (
    <div className={`lb-tr scene lb-in${note ? ' lb-noted' : ''}${picked ? ' lb-selected' : ''}`}>
      <button type="button" role="checkbox" aria-checked={picked} className="lb-sel" onClick={() => onPick(scene.id, true, false)} aria-label={`${role || 'Yeni sahne'}: seç`} title="Seç (birden çok sahneye tek not)">
        <span className="n">{n}</span>
        <span className="box">{picked ? <Icon name="check" size="sm" /> : null}</span>
      </button>
      <span className="lb-tr-time">{formatClock(start)}</span>
      <FrameSlot run={run} scene={scene} remaking={remaking} />
      <div className="lb-td">
        <div className="lb-tr-title">
          <b>
            <EditableText
              label="Sahnenin adı"
              value={role}
              placeholder="Sahne adı"
              startEditing={writing === 'role'}
              onChange={(text) => text && run.edit(`role:${scene.id}`, text)}
              onEnter={() => setWriting(writing === 'role' ? 'say' : null)}
            />
          </b>
          <span>{scene.seconds} sn</span>
          <SourcePicker
            run={run}
            scene={{ id: scene.id, role: role || 'Yeni sahne', assetId: null }}
            seconds={scene.seconds}
            planned="generate"
            queue={false}
          />
        </div>
        <p>
          <EditableText
            key={writing === 'say' ? 'say-new' : 'say'}
            label={`${role || 'Yeni sahne'}: anlatım`}
            value={run.state.edits[`say:${scene.id}`] ?? scene.say}
            placeholder="Anlatım yaz…"
            startEditing={writing === 'say'}
            onChange={(text) => run.edit(`say:${scene.id}`, text)}
            onEnter={() => setWriting(null)}
          />
        </p>
        {remaking ? <div className="lb-tr-screen">Spark bu sahneyi planlıyor…</div> : null}
        {note ? (
          <span className="lb-note-chip">
            <button type="button" onClick={() => onPick(scene.id, false, true)} title="Listede · notu düzenle">
              <Icon name="note" size="sm" />
              <span>{note.text}</span>
            </button>
            <button type="button" onClick={() => run.dropNote(note.id)} aria-label="Notu sil" title="Notu sil"><Icon name="x" size="sm" /></button>
          </span>
        ) : null}
      </div>
      <div className="lb-tr-tags" />
      <div className="lb-row-acts">
        <button
          type="button"
          className={`lb-fix${picked ? ' on' : ''}`}
          onClick={(event) => onPick(scene.id, several(event), true)}
          disabled={remaking}
          title="Düzelt: Spark’a ne değişeceğini yaz"
          aria-label={`${role}: düzelt`}
        >
          <Icon name="wand" size="sm" />
        </button>
        <button type="button" className="ib xs" onClick={onRemove} title="Sahneyi kaldır" aria-label={`${role}: kaldır`}><Icon name="trash" size="sm" /></button>
      </div>
      {toolbar}
    </div>
  )
}

// ---- cast and look: a choice, and the things to choose from --------------------------------------------------

/**
 * A row that is a choice. It shows what was chosen (who, in which voice, which kit, which caption style) as a
 * thing, not as a sentence, and opens into the options below it. With nothing chosen it is only the way to add.
 */
function LookRow({ row, run, open, onToggle }: { row: ContextRow; run: LabRun; open: boolean; onToggle: () => void }) {
  const options = LOOK_OPTIONS[row.id] ?? []
  const picked = pickOf(run.state, row.id)
  const option = options.find((entry) => entry.id === picked)
  // A voice made from scratch is its traits.
  const traits = picked?.startsWith('new:') ? picked.slice(4).split('|') : null
  // The note on the agent's own choice goes once the user has chosen something else.
  const note = row.id in run.state.picks ? null : thisVideoOnly(row, run)

  return (
    <div className={`lb-tr look lb-in${open ? ' open' : ''}`}>
      <span className="lb-th">{row.title}</span>
      <div className="lb-td">
        {option || traits ? (
          <button type="button" className="lb-token" onClick={onToggle} aria-expanded={open}>
            <Mark row={row.id} option={option} />
            <span className="lb-token-text">
              <b>{option ? option.title : 'Yeni ses'}</b>
              <small>{[option ? option.sub : 'Sıfırdan oluşturulacak', note].filter(Boolean).join(' · ')}</small>
            </span>
            {(option?.tags ?? traits ?? []).map((tag) => <span key={tag} className="stag">{tag}</span>)}
          </button>
        ) : (
          <button type="button" className="lb-addbtn" onClick={onToggle} aria-expanded={open}>
            <Icon name="plus" size="sm" />
            {row.action ?? `${row.title} seç`}
          </button>
        )}
      </div>
      <div className="lb-tr-acts">
        {note ? <Keep row={row} run={run} /> : null}
        {option || traits ? <button type="button" className="lb-act" onClick={onToggle}>{open ? 'Kapat' : 'Değiştir'}</button> : null}
      </div>
      {open ? (
        <div className="lb-picker">
          <div className="lb-opts" role="listbox" aria-label={row.title}>
            {options.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="option"
                aria-selected={entry.id === picked}
                className={`lb-opt${entry.id === picked ? ' on' : ''}`}
                onClick={() => {
                  run.pick(row.id, entry.id)
                  onToggle()
                }}
              >
                <Mark row={row.id} option={entry} />
                <span className="lb-token-text">
                  <b>{entry.title}</b>
                  {entry.sub ? <small>{entry.sub}</small> : null}
                </span>
                {entry.id === picked ? <Icon name="check" size="sm" /> : null}
              </button>
            ))}
          </div>
          {row.id === 'voice' ? (
            <VoiceMaker
              traits={traits}
              onMake={(next) => {
                run.pick(row.id, `new:${next.join('|')}`)
                onToggle()
              }}
            />
          ) : null}
          {row.action && picked ? (
            <button
              type="button"
              className="lb-act"
              onClick={() => {
                run.pick(row.id, null)
                onToggle()
              }}
            >
              Karakteri kaldır
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** What a choice looks like at a glance: a face, a mark for the voice, the kit's colours, the caption as it will read. */
function Mark({ row, option }: { row: string; option?: LookOption }) {
  if (option?.initials) return <span className="lb-mark face">{option.initials}</span>
  if (option?.swatch) return <span className="lb-mark swatch">{option.swatch.map((colour) => <i key={colour} style={{ background: colour }} />)}</span>
  if (row === 'cap') return <span className={`lb-mark cap ${option?.id ?? ''}`}>Aa</span>
  return <span className="lb-mark"><Icon name={row === 'voice' ? 'mic' : row === 'music' ? 'music' : 'scenes'} size="sm" /></span>
}

/** A voice that does not exist yet is described by what it is, not written out: one of each. */
function VoiceMaker({ traits, onMake }: { traits: string[] | null; onMake: (traits: string[]) => void }) {
  const [chosen, setChosen] = React.useState<string[]>(() => VOICE_TRAITS.map((group, index) => traits?.[index] ?? group.options[0]!))
  return (
    <div className="lb-make">
      <b>Sıfırdan oluştur</b>
      {VOICE_TRAITS.map((group, index) => (
        <div key={group.label} className="lb-make-row" role="radiogroup" aria-label={group.label}>
          <span>{group.label}</span>
          {group.options.map((entry) => (
            <button
              key={entry}
              type="button"
              role="radio"
              aria-checked={chosen[index] === entry}
              className={`lb-chip${chosen[index] === entry ? ' on' : ''}`}
              onClick={() => setChosen(chosen.map((value, position) => (position === index ? entry : value)))}
            >
              {entry}
            </button>
          ))}
        </div>
      ))}
      <button type="button" className="btn sm" onClick={() => onMake(chosen)}>Bu sesi oluştur</button>
    </div>
  )
}

/**
 * The one mark a row can carry, in words on its own line: a choice that holds for this video alone (the agent's
 * own, or one it suggested). Rows that came from the channel carry nothing.
 */
function thisVideoOnly(row: ContextRow, run: LabRun) {
  if (!row.promotable || run.state.promoted.includes(row.id)) return null
  return row.source === 'assumed' ? 'Spark seçti, yalnız bu video için' : 'yalnız bu video için'
}

/** The way to keep such a choice for videos of this kind; once kept, the row says so. */
function Keep({ row, run }: { row: ContextRow; run: LabRun }) {
  if (!row.promotable) return null
  if (run.state.promoted.includes(row.id)) return <span className="lb-note saved"><Icon name="check" size="sm" />Kanala kaydedildi</span>
  return (
    <button type="button" className="lb-act" onClick={() => run.promote(row.id)} title="Kanala kaydet: bundan sonra bu tür videolarda da kullanılır">
      Bu tür videolarda kullan
    </button>
  )
}

// ---- the script ------------------------------------------------------------------------------------------------

// A scene's row. Its line is rewritten in place (the pencil, or a click on it). Anything else about it — the picture,
// the source, the pace — is told to Spark: "Düzelt" (or the box on its number, to pick several) opens the toolbar
// under the row, where a note is kept for later or everything is made again at once. A kept note waits on the row;
// what a remake changed stays there and can be taken back. The source and model of the scene's picture open from its
// tag. The frame is a low-resolution draft made with the model and source the final will use, so what is approved
// here is what gets produced in full quality.
function SceneRow({
  scene,
  run,
  picked,
  onPick,
  toolbar,
}: {
  scene: LabScene
  run: LabRun
  picked: boolean
  onPick: (id: string, add: boolean, focus: boolean) => void
  toolbar: React.ReactNode
}) {
  const { here, doing, status } = presenceOf(run, scene)
  const uses = CONTEXT.filter((row) => scene.uses.includes(row.id))
  const asks = run.state.asks[scene.id] ?? []
  const lastAsk = asks[asks.length - 1]
  // A source or model change shows on the source tag; only what was written to Spark is a chip on the row.
  const pending = notesOn(run.state, scene.id)
  const note = pending.find((entry) => entry.kind !== 'source') ?? null
  const remaking = applyingTo(run.state, scene.id)
  const draftLabel = asks.length ? `Taslak v${asks.length + 1}` : 'Taslak'
  const several = (event: React.MouseEvent) => event.shiftKey || event.metaKey || event.ctrlKey
  return (
    <div className={`lb-tr scene lb-in ${status}${here ? ' lb-agent-on' : ''}${pending.length ? ' lb-noted' : ''}${picked ? ' lb-selected' : ''}`} data-agent-target={`card-${scene.id}`}>
      <button type="button" role="checkbox" aria-checked={picked} className="lb-sel" onClick={() => onPick(scene.id, true, false)} aria-label={`${scene.role}: seç`} title="Seç (birden çok sahneye tek not)">
        <span className="n">{scene.n}</span>
        <span className="box">{picked ? <Icon name="check" size="sm" /> : null}</span>
      </button>
      <span className="lb-tr-time">{formatClock(scene.start)}</span>
      <div className={`lb-tr-pic${remaking ? ' redrafting' : ''}`}>
        <SceneThumb scene={scene} run={run} planned />
        <span className="lb-draft-tag" title="Düşük çözünürlüklü taslak kare. Final, aynı model ve kaynakla tam kalitede üretilir.">{draftLabel}</span>
      </div>
      <div className="lb-td">
        <div className="lb-tr-title">
          <b>{scene.role}</b>
          <span>{scene.end - scene.start} sn</span>
          <SourcePicker run={run} scene={scene} seconds={scene.end - scene.start} />
          <SceneDot status={status} />
          {here ? <em>{doing}</em> : null}
        </div>
        <p>
          <EditableText label={`${scene.role}: anlatım`} value={sayOf(run.state, scene)} placeholder="Anlatım yok" onChange={(text) => run.edit(`say:${scene.id}`, text)} />
        </p>
        <div className="lb-tr-screen">
          <span>Ekranda</span>
          {scene.layers.map((layer) => layer.text).join(' · ')}
        </div>
        {remaking ? (
          <div className="lb-asked" role="status">
            <span className="spin" />
            Spark düzeltiyor…
          </div>
        ) : lastAsk ? (
          <div className="lb-asked">
            <Icon name="refresh" size="sm" />
            <span>{lastAsk.text ? 'Düzeltildi:' : 'Yeniden üretildi'}</span>
            {lastAsk.text ? <q>{lastAsk.text}</q> : null}
            <button type="button" className="lb-act" onClick={() => run.undoAsk(scene.id)}>
              <Icon name="undo" size="sm" />
              Geri al
            </button>
          </div>
        ) : null}
        {note ? (
          <span className="lb-note-chip">
            <button type="button" onClick={() => onPick(scene.id, false, true)} title="Listede · notu düzenle">
              <Icon name="note" size="sm" />
              <span>{note.text}</span>
            </button>
            <button type="button" onClick={() => run.dropNote(note.id)} aria-label="Notu sil" title="Notu sil"><Icon name="x" size="sm" /></button>
          </span>
        ) : null}
      </div>
      <div className="lb-tr-tags">
        {uses.map((row) => (
          <span key={row.id} className="stag" title={row.title}>{row.group === 'rules' ? 'Kural' : row.title}</span>
        ))}
      </div>
      <div className="lb-row-acts">
        <button
          type="button"
          className={`lb-fix${picked ? ' on' : ''}`}
          onClick={(event) => onPick(scene.id, several(event), true)}
          disabled={remaking}
          title="Düzelt: Spark’a ne değişeceğini yaz"
          aria-label={`${scene.role}: düzelt`}
        >
          <Icon name="wand" size="sm" />
        </button>
        <LockButton run={run} scene={scene} />
      </div>
      {toolbar}
    </div>
  )
}
