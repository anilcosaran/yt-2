'use client'

import * as React from 'react'

import { SCENES } from './lab-model'
import { AgentBar, AgentCursor, Chat, Composer, Icon, LabDock, LabStage, PlanList, ToolRail, TopBar } from './lab-parts'
import { Splitter, useSplitSize } from './lab-split'
import { revealed, type LabRun } from './use-lab-run'

// The "Editör" view (`?v=a`). Today's editor, unchanged in structure: tool rail and drawer, canvas, timeline,
// and Spark's panel. The agent works inside it under its own cursor while a bar says who is driving. The brief,
// the script and what they draw on live in the Plan view; the chat card leads there. An empty project has one
// start, the chat's: the scenes drawer stays shut until there is a scene, the stage and the timeline stay quiet.

export function VariantCopilot({ run, onOpenPlan }: { run: LabRun; onOpenPlan: () => void }) {
  const scope = React.useRef<HTMLDivElement>(null)
  const [drawerWanted, setDrawerWanted] = React.useState(true)
  const hasScenes = revealed(run.state, SCENES[0]!.at)
  const drawerOpen = hasScenes && drawerWanted
  // The editor's own layout variables (`--st-drawer-w`, `--st-right-w`): a dragged edge sets them.
  const drawer = useSplitSize('editor-drawer')
  const right = useSplitSize('editor-right')
  const layout = { ...(drawer && { '--st-drawer-w': `${drawer}px` }), ...(right && { '--st-right-w': `${right}px` }) } as React.CSSProperties

  return (
    <div className={`app lb-a${drawerOpen ? '' : ' no-drawer'}`} ref={scope} style={layout}>
      <TopBar run={run} />
      <div className="main">
        <ToolRail
          lead={
            <button
              type="button"
              className={`rail-btn${drawerOpen ? ' on' : ''}`}
              disabled={!hasScenes}
              title={hasScenes ? undefined : 'Henüz sahne yok'}
              onClick={() => setDrawerWanted(!drawerOpen)}
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
              <button type="button" className="ib sm" aria-label="Kapat" onClick={() => setDrawerWanted(false)}><Icon name="left" /></button>
            </div>
            <div className="dr-body">
              <PlanList run={run} onPick={run.view} />
            </div>
          </div>
        </aside>

        <section className="center">
          <div className="lb-bar-slot"><AgentBar run={run} /></div>
          <LabStage run={run} />
          <LabDock run={run} sizeKey="editor-dock" />
        </section>

        <aside className="right">
          <Splitter id="editor-right" axis="x" edge="start" min={300} max={560} label="Spark panelinin genişliği" />
          <div className="right-inner">
            <div className="pane">
              <Chat run={run} onOpenPlan={onOpenPlan} controls={false} />
              <div className="composer-wrap"><Composer run={run} /></div>
            </div>
          </div>
        </aside>
      </div>
      <AgentCursor scope={scope} run={run} />
    </div>
  )
}
