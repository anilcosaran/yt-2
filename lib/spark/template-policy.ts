import { z } from 'zod'

import type { CompositionDocument } from './composition-client'

/**
 * P06-03 Add Scene policy of a project (SAHNE §7 `Sahne ekle`, KARAR-MINIMAL-SPARK "template instance pinli extension
 * policy'yi devralır"). The working copy carries the template instances (`composition_document_v1.template_instances`);
 * the most restrictive pinned `extension_policy` decides what the editor's `+` does. The server applies the same rule
 * to every command, so this only avoids offering a command the server would refuse.
 *
 * - `freeform`: the plain `+` (an empty scene after the selected one) — every empty or freeform project.
 * - `library` (`approved_scene_only`) / `template` (`current_template_only`): scenes come from the template (its Scene
 *   Library picker is a pending design decision), so the plain `+` is passive with the reason.
 * - `locked` (`locked_sequence`): passive with the reason.
 */
export type SparkAddSceneMode = 'freeform' | 'library' | 'template' | 'locked'

const RANK = { freeform: 0, approved_scene_only: 1, current_template_only: 2, locked_sequence: 3 } as const
type ExtensionPolicy = keyof typeof RANK

const instancesSchema = z.array(
  z.object({ extension_policy: z.enum(['freeform', 'approved_scene_only', 'current_template_only', 'locked_sequence']) }).passthrough(),
)

const MODE: Record<ExtensionPolicy, SparkAddSceneMode> = {
  freeform: 'freeform',
  approved_scene_only: 'library',
  current_template_only: 'template',
  locked_sequence: 'locked',
}

export function sparkAddSceneMode(document: CompositionDocument | null): SparkAddSceneMode {
  const raw = (document as (CompositionDocument & { template_instances?: unknown }) | null)?.template_instances
  if (raw === undefined || raw === null) return 'freeform'
  const parsed = instancesSchema.safeParse(raw)
  // An instance list the client cannot read never opens a free `+`: the server decides, the button stays passive.
  if (!parsed.success) return 'locked'
  let effective: ExtensionPolicy = 'freeform'
  for (const instance of parsed.data) {
    if (RANK[instance.extension_policy] > RANK[effective]) effective = instance.extension_policy
  }
  return MODE[effective]
}

/** i18n key (under `Spark.editor`) of the reason a non-freeform `+` is passive; null when the plain `+` is allowed. */
export function sparkAddSceneReasonKey(mode: SparkAddSceneMode): string | null {
  switch (mode) {
    case 'freeform':
      return null
    case 'library':
      return 'template.addSceneFromLibrary'
    case 'template':
      return 'template.addSceneFromTemplate'
    case 'locked':
      return 'template.addSceneLocked'
  }
}
