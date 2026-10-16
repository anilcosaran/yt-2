'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { StorageMediaPickerDialog, uploadStorageMedia, type StorageMediaSelection } from '@/components/storage/storage-media-input'
import { useOptionalActiveChannel } from '@/lib/channel/active-channel'
import { Icon } from '../tools/studio-parts'
import { DEFAULT_MODEL, MODELS, SOURCE_KINDS, SOURCE_LABEL, assetById, type AssetKind, type LabScene } from './lab-model'
import type { AddedScene, LabMedia, LabRun } from './use-lab-run'
import './lab-notes.css'

const SOURCE_ICON: Record<AssetKind, string> = { library: 'image', generate: 'wand', stock: 'video', kit: 'palette' }
const SOURCE_HINT: Record<'stock' | 'kit', string> = {
  stock: 'Spark sahneye uyan bir stok klip seçer.',
  kit: 'Brand Kit’teki görsel ve renkler kullanılır.',
}
/** The Spark editor has no workspace shell, so no active channel: its Storage is the lab's own. */
const LAB_STORAGE_CHANNEL = 'spark-lab'

type UploadState = { fileName: string; phase: 'preparing' | 'uploading'; progress: number }

/** Closes a popup on a click outside `box` or on Escape. */
function useDismiss(open: boolean, box: React.RefObject<HTMLElement | null>, close: () => void) {
  React.useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) close()
    }
    const esc = (event: KeyboardEvent) => event.key === 'Escape' && close()
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open, box, close])
}

/**
 * The app's Storage picker (the asset manager of Tools and the Chat) for a scene's pictures: pick from Storage, or
 * upload there (from its own button, or a file dropped on the frame). Audio is not a picture and is passed over.
 * `element` is to be rendered by a component that stays mounted while the dialog is open. The dialog draws in place,
 * so it is put on the page's body: inside the lab it would take the lab's styles.
 */
function useStorageMediaPicker(onPick: (media: LabMedia) => void) {
  const channelId = useOptionalActiveChannel()?.activeChannelId ?? LAB_STORAGE_CHANNEL
  const [open, setOpen] = React.useState(false)
  const [uploadState, setUploadState] = React.useState<UploadState | null>(null)
  const input = React.useRef<HTMLInputElement>(null)
  const pick = React.useRef(onPick)
  React.useEffect(() => {
    pick.current = onPick
  })

  const take = (selection: StorageMediaSelection, fallbackUrl?: string) => {
    if (selection.mimeType?.startsWith('audio/')) return
    pick.current({
      title: selection.name,
      url: selection.previewUrl ?? fallbackUrl,
      video: Boolean(selection.mimeType?.startsWith('video/')),
      objectId: selection.storageObjectId,
    })
    setOpen(false)
  }
  const upload = async (file: File | undefined) => {
    if (!file || !/^(image|video)\//.test(file.type)) return
    setUploadState({ fileName: file.name, phase: 'preparing', progress: 0 })
    try {
      const selection = await uploadStorageMedia(channelId, file, 'all', undefined, (progress) => setUploadState({ fileName: file.name, phase: 'uploading', progress }))
      take(selection, URL.createObjectURL(file))
    } catch {
      // Storage refused the file (the demo has no real Storage): the picture is still shown from the browser.
      pick.current({ title: file.name, url: URL.createObjectURL(file), video: file.type.startsWith('video/') })
      setOpen(false)
    } finally {
      setUploadState(null)
    }
  }

  const element = (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(event) => {
          void upload(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      {open
        ? createPortal(
            <StorageMediaPickerDialog
              open={open}
              channelId={channelId}
              mediaKind="all"
              uploadState={uploadState}
              onOpenChange={setOpen}
              onUpload={() => input.current?.click()}
              onSelect={(selection) => take(selection)}
            />,
            document.body,
          )
        : null}
    </>
  )
  return { open: () => setOpen(true), upload, element }
}

/** A picture or clip as a small frame: the file itself, the demo's drawing of it, or (no preview yet) what kind it is. */
function MediaThumb({ media }: { media: LabMedia }) {
  if (!media.url && media.art) return <span className={`lb-art ${media.art}`} />
  if (!media.url) return <span className="lb-media-none"><Icon name={media.video ? 'video' : 'image'} size="sm" /></span>
  if (media.video) return <video src={media.url} muted loop autoPlay playsInline />
  // A Storage preview or a file the user just picked (a blob URL): there is nothing for next/image to optimise.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={media.url} alt="" />
}

/**
 * The source of a scene's picture as a tag, and what it opens into. A scene's picture has one source at a time:
 * "Görselim" (the user's own media, used as it is: no model), "AI üretsin" (a model makes it; it may be given a
 * reference picture to make from), "Stok" or "Brand Kit". Each keeps what was picked for it, so switching back finds it.
 * Resolution and format are the project's, never the scene's: the AI tab only says what comes out.
 *
 * On a scene whose draft frame is made (`queue`), a change makes that frame out of date: it waits on the list for
 * "Hepsini düzelt" (the tag carries a dot), and going back to the plan's own choice drops it. A scene with no frame
 * yet just takes the choice.
 */
export function SourcePicker({
  run,
  scene,
  seconds,
  planned: plannedKind,
  queue = true,
}: {
  run: LabRun
  scene: Pick<LabScene, 'id' | 'role' | 'assetId'>
  seconds: number
  /** Where the plan means the picture to come from when the scene has no asset yet. */
  planned?: AssetKind
  queue?: boolean
}) {
  const asset = assetById(scene.assetId)
  const planned: AssetKind = asset?.kind ?? plannedKind ?? 'kit'
  const kind = (run.state.picks[`source:${scene.id}`] as AssetKind | undefined) ?? planned
  const model = MODELS.find((entry) => entry.id === (run.state.picks[`model:${scene.id}`] ?? DEFAULT_MODEL)) ?? MODELS[0]!
  const media = run.state.media[scene.id] ?? null
  const ref = run.state.refs[scene.id] ?? null
  // A planned scene whose own clip is the user's: that clip is its "Görselim" until another is picked.
  const ownMedia = media ?? (asset?.kind === 'library' ? { title: asset.title, art: asset.art } : null)
  const kept = run.state.notes.find((note) => note.kind === 'source' && note.targets.length === 1 && note.targets[0] === scene.id)

  const [open, setOpen] = React.useState(false)
  const [pickingFor, setPickingFor] = React.useState<'media' | 'ref'>('media')
  const box = React.useRef<HTMLSpanElement>(null)
  const close = React.useCallback(() => setOpen(false), [])
  useDismiss(open, box, close)

  type Choice = { source: AssetKind; model: string; media: LabMedia | null; ref: LabMedia | null }
  const now: Choice = { source: kind, model: model.id, media, ref }
  const sync = (next: Choice) => {
    if (!queue) return
    const unchanged =
      next.source === planned &&
      (next.source !== 'generate' || (next.model === DEFAULT_MODEL && !next.ref)) &&
      (next.source !== 'library' || !next.media)
    if (unchanged) {
      if (kept) run.dropNote(kept.id)
      return
    }
    const title = MODELS.find((entry) => entry.id === next.model)?.title ?? next.model
    const text =
      next.source === 'generate' ? `Model: ${title}${next.ref ? ' · referans görselle' : ''}`
      : next.source === 'library' ? `Görselim${next.media ? `: ${next.media.title}` : ''}`
      : `Kaynak: ${SOURCE_LABEL[next.source]}`
    run.saveNote({ id: kept?.id, targets: [scene.id], labels: [scene.role], text, kind: 'source' })
  }
  const setSource = (source: AssetKind) => {
    run.pick(`source:${scene.id}`, source)
    sync({ ...now, source })
  }
  const setModel = (id: string) => {
    run.pick(`model:${scene.id}`, id)
    sync({ ...now, model: id })
    setOpen(false)
  }
  const picker = useStorageMediaPicker((picked) => {
    if (pickingFor === 'ref') {
      run.setRef(scene.id, picked)
      // A model that cannot make from a picture gives way to one that can.
      const nextModel = model.reference ? model.id : DEFAULT_MODEL
      if (nextModel !== model.id) run.pick(`model:${scene.id}`, nextModel)
      sync({ ...now, model: nextModel, ref: picked })
    } else {
      run.setMedia(scene.id, picked)
      run.pick(`source:${scene.id}`, 'library')
      sync({ ...now, source: 'library', media: picked })
    }
  })
  const choose = (target: 'media' | 'ref') => {
    setPickingFor(target)
    setOpen(false)
    picker.open()
  }

  const tagTitle = kind === 'generate' ? model.title : SOURCE_LABEL[kind]
  return (
    <span className="lb-src" ref={box}>
      <button
        type="button"
        className={`stag lb-src-btn${open ? ' on' : ''}${kept ? ' changed' : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={kept ? 'Değişti · “Hepsini düzelt” ile kareye uygulanır' : 'Sahnenin görseli nereden gelsin'}
      >
        <Icon name={SOURCE_ICON[kind]} />
        {asset ? `${asset.id} · ` : ''}
        {tagTitle}
        {kind === 'generate' && ref ? <Icon name="image" /> : null}
        <Icon name="down" />
      </button>
      {open ? (
        <span className="lb-src-pop" role="dialog" aria-label={`${scene.role}: görselin kaynağı`}>
          <span className="lb-src-seg" role="radiogroup" aria-label="Kaynak">
            {SOURCE_KINDS.map((entry) => (
              <button key={entry} type="button" role="radio" aria-checked={entry === kind} className={entry === kind ? 'on' : undefined} onClick={() => entry !== kind && setSource(entry)}>
                {SOURCE_LABEL[entry]}
              </button>
            ))}
          </span>

          {kind === 'library' ? (
            ownMedia ? (
              <span className="lb-src-media">
                <span className="lb-src-thumb"><MediaThumb media={ownMedia} /></span>
                <span className="lb-src-text">
                  <b>{ownMedia.title}</b>
                  <small>Olduğu gibi kullanılır</small>
                </span>
                <button type="button" className="lb-act" onClick={() => choose('media')}>Değiştir</button>
              </span>
            ) : (
              <button type="button" className="lb-slot-opt" onClick={() => choose('media')}>
                <Icon name="upload" size="sm" />
                <span>
                  <b>Medya seç</b>
                  <small>Depodan seç ya da yükle; olduğu gibi kullanılır</small>
                </span>
              </button>
            )
          ) : kind === 'generate' ? (
            <>
              <Command className="lb-src-cmd">
                <CommandInput placeholder="Model ara…" />
                <CommandList>
                  <CommandEmpty>Model bulunamadı</CommandEmpty>
                  {(['video', 'image'] as const).map((group) => (
                    <CommandGroup key={group} heading={group === 'video' ? 'Video' : 'Görsel'}>
                      {MODELS.filter((entry) => entry.kind === group).map((entry) => {
                        const blocked = Boolean(ref) && !entry.reference
                        return (
                          <CommandItem key={entry.id} value={`${entry.title} ${entry.meta}`} disabled={blocked} onSelect={() => setModel(entry.id)}>
                            <span className="lb-src-model">
                              <b>{entry.title}</b>
                              <small>{blocked ? 'Referans görselden üretemez' : entry.meta}</small>
                            </span>
                            {entry.id === model.id ? <Icon name="check" size="sm" /> : null}
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  ))}
                </CommandList>
              </Command>
              {ref ? (
                <span className="lb-src-media">
                  <span className="lb-src-thumb"><MediaThumb media={ref} /></span>
                  <span className="lb-src-text">
                    <b>Referans görsel</b>
                    <small>{model.kind === 'video' ? 'Video bu görselden başlar' : 'Görsel bundan üretilir'}</small>
                  </span>
                  <button
                    type="button"
                    className="ib xs"
                    onClick={() => {
                      run.setRef(scene.id, null)
                      sync({ ...now, ref: null })
                    }}
                    title="Referansı kaldır"
                    aria-label="Referansı kaldır"
                  >
                    <Icon name="x" size="sm" />
                  </button>
                </span>
              ) : (
                <button type="button" className="lb-src-addref" onClick={() => choose('ref')}>
                  <Icon name="plus" size="sm" />
                  Referans görsel ekle
                  <small>isteğe bağlı</small>
                </button>
              )}
              <small className="lb-src-out">
                Çıktı: {run.state.ratio} · 1080p · {seconds} sn{model.kind === 'image' ? ' · durağan kare, hafif hareketle' : ''} · projeden
              </small>
            </>
          ) : (
            <span className="lb-src-hint">{SOURCE_HINT[kind]}</span>
          )}
          {queue ? <small className="lb-src-foot">Taslak kare “Hepsini düzelt” ile yeniden üretilir.</small> : null}
        </span>
      ) : null}
      {picker.element}
    </span>
  )
}

/**
 * The frame of a scene the user added: what its source gives it (their own media, the reference its model makes from,
 * or nothing yet). A click, or a file dropped on it, puts the user's own media there from Storage ("Görselim").
 */
export function FrameSlot({ run, scene, remaking }: { run: LabRun; scene: AddedScene; remaking: boolean }) {
  const kind = (run.state.picks[`source:${scene.id}`] as AssetKind | undefined) ?? 'generate'
  const media = run.state.media[scene.id]
  const ref = run.state.refs[scene.id]
  const shown = kind === 'library' ? media : kind === 'generate' ? ref : undefined
  const [over, setOver] = React.useState(false)
  const picker = useStorageMediaPicker((picked) => {
    run.setMedia(scene.id, picked)
    run.pick(`source:${scene.id}`, 'library')
  })
  const empty =
    kind === 'generate' ? { icon: 'wand', label: 'AI üretecek' }
    : kind === 'library' ? { icon: 'plus', label: 'Görsel' }
    : { icon: SOURCE_ICON[kind], label: SOURCE_LABEL[kind] }

  return (
    <div
      className="lb-slot"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        void picker.upload(event.dataTransfer.files[0])
      }}
    >
      <button
        type="button"
        className={`lb-tr-pic lb-slot-pic${shown ? '' : ' vacant'}${over ? ' over' : ''}${remaking ? ' redrafting' : ''}`}
        onClick={picker.open}
        title="Kendi görselini koy: depodan seç ya da yükle"
      >
        {shown ? (
          <span className="lb-thumb">
            <MediaThumb media={shown} />
            {kind === 'generate' ? <span className="lb-slot-badge">Referans</span> : null}
          </span>
        ) : (
          <span className="lb-slot-add">
            <Icon name={empty.icon} size="sm" />
            {empty.label}
          </span>
        )}
      </button>
      {picker.element}
    </div>
  )
}
