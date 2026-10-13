/**
 * The Motion UI switch (E1-D). `MOTION_UI_ENABLED=true` on the UI pod shows the "Motion" entry of the main sidebar
 * (next to Spark) and opens the Motion tool of the Spark editor rail (the Motion drawer: Library / My Motions / Premium,
 * insert at the playhead or at a dropped second, the Properties parameters of a Motion layer). Off (the code default; any
 * value but exactly `true`) the sidebar has no Motion entry and the rail tool stays "coming soon", exactly as before.
 *
 * Read on the server in the root layout and in the force-dynamic editor page and passed down as a prop, so flipping it
 * needs only a pod restart. The Motion pages themselves (`/motion`) are guarded by the gateway switches
 * (`BRAND_MOTION_TYPED_SEEDS_ENABLED`, `BRAND_MOTION_AUTHORING_ENABLED`, `BRAND_ELEMENTS_ENABLED`,
 * `BRAND_VIDEO_STYLE_ENABLED`, `COMPOSITION_MOTION_INSTANCES_ENABLED`; all default off): with one of them closed the
 * screens say so instead of offering Motions. Nothing here reads or writes product data.
 */
export const MOTION_UI_SWITCH = 'MOTION_UI_ENABLED'

// yt-2: on by default so every screen can be designed; set MOTION_UI_ENABLED=false to hide it.
export function motionUiEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env[MOTION_UI_SWITCH] !== 'false'
}
