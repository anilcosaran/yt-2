'use client'

import * as React from 'react'

import { SCENES } from './lab-model'
import { AgentBar, AgentCursor, Chat, Composer, Icon, LabDock, LabStage, PlanList, SparkPanelToggle, ToolRail, TopBar, useEscapeToClose, useNarrow, useSparkPanel } from './lab-parts'
import { Splitter, usePaneOpen, useSplitSize } from './lab-split'
import { revealed, type LabRun } from './use-lab-run'

// The "Editör" view (`?v=a`). Today's editor, unchanged in structure: tool rail and drawer, canvas, timeline,
// and Spark's panel. It opens on the work: the scenes drawer and Spark's panel are shut unless the user opened them
// (kept per browser); Spark's panel opens by itself when Spark cannot go on without the user (`useSparkPanel`), and
// its live work shows on the canvas meanwhile, under its own cursor and the bar that says who is driving. The brief,
// the script and what they draw on live in the Plan view; the chat card leads there. An empty project has one
// start, the chat's: the scenes drawer stays shut until there is a scene, the stage and the timeline stay quiet.
// Where a drawer or the panel covers the canvas (narrow), it is for this visit only and a click on the canvas or
// Escape closes it.

/** Container widths at and under which the drawer, then Spark's panel, cover the canvas (studio.css). */
const DRAWER_OVER = 1100
const PANEL_OVER = 900

export function VariantCopilot({ run, onOpenPlan }: { run: LabRun; onOpenPlan: () => void }) {
  const scope = React.useRef<HTMLDivElement>(null)
  const hasScenes = revealed(run.state, SCENES[0]!.at)
  const [drawerKept, keepDrawer] = usePaneOpen('editor-drawer', false)
  const drawerOver = useNarrow(scope, DRAWER_OVER)
  const [drawerHere, setDrawerHere] = React.useState(false)
  const drawerOpen = hasScenes && (drawerOver ? drawerHere : drawerKept)
  const setDrawerOpen = drawerOver ? setDrawerHere : keepDrawer
  const spark = useSparkPanel(run, 'editor-chat', { scope, narrowAt: PANEL_OVER, approval: true })
  const drawerCovers = drawerOver && drawerOpen
  const panelCovers = spark.narrow && spark.open
  const closeCovers = () => {
    if (drawerCovers) setDrawerHere(false)
    if (panelCovers) spark.setOpen(false)
  }
  useEscapeToClose(drawerCovers || panelCovers, closeCovers)
  // A pane kept open arrives open: it does not slide in on the first frame (`resizing` holds the layout still).
  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  // The editor's own layout variables (`--st-drawer-w`, `--st-right-w`): a dragged edge sets them.
  const drawer = useSplitSize('editor-drawer')
  const right = useSplitSize('editor-right')
  const layout = { ...(drawer && { '--st-drawer-w': `${drawer}px` }), ...(right && { '--st-right-w': `${right}px` }) } as React.CSSProperties

  return (
    <div className={`app lb-a${drawerOpen ? '' : ' no-drawer'}${spark.open ? '' : ' no-right'}${settled ? '' : ' resizing'}`} ref={scope} style={layout}>
      <TopBar run={run} panel={<SparkPanelToggle panel={spark} />} />
      <div className="main">
        <ToolRail
          lead={
            <button
              type="button"
              className={`rail-btn${drawerOpen ? ' on' : ''}`}
              disabled={!hasScenes}
              aria-expanded={drawerOpen}
              title={hasScenes ? undefined : 'Henüz sahne yok'}
              onClick={() => setDrawerOpen(!drawerOpen)}
            >
              <Icon name="scenes" />
              Sahneler
            </button>
          }
        />

        <aside className="drawer">
          <Splitter id="editor-drawer" axis="x" edge="end" min={240} max={480} label="Sahneler panelinin genişliği" />
          <div className="drawer-inner">
            <div className="dr-head">
              <h2>Sahneler</h2>
              <button type="button" className="ib sm" aria-label="Kapat" onClick={() => setDrawerOpen(false)}><Icon name="left" /></button>
            </div>
            <div className="dr-body">
              <PlanList
                run={run}
                onPick={(sceneId) => {
                  run.view(sceneId)
                  // Over the canvas, the drawer gets out of the way of the scene that was picked.
                  if (drawerOver) setDrawerHere(false)
                }}
              />
            </div>
          </div>
        </aside>

        <section className="center" onPointerDown={drawerCovers || panelCovers ? closeCovers : undefined}>
          <div className="lb-bar-slot"><AgentBar run={run} /></div>
          <LabStage run={run} />
          <LabDock run={run} sizeKey="editor-dock" onAsk={() => spark.setOpen(true)} />
        </section>

        {/* Mounted only while open: a hidden question must not take the number keys that answer it. */}
        {spark.open ? (
          <aside className="right" id={spark.id}>
            <Splitter id="editor-right" axis="x" edge="start" min={300} max={560} label="Spark panelinin genişliği" />
            <div className="right-inner">
              <div className="pane">
                <Chat run={run} onOpenPlan={onOpenPlan} controls={false} />
                <div className="composer-wrap"><Composer run={run} /></div>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
      <AgentCursor scope={scope} run={run} />
    </div>
  )
}
