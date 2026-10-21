/**
 * The corner a `position: fixed` box inside `host` is placed from, in window coordinates: the window's own corner,
 * or that of an ancestor that holds fixed boxes (a transform, a filter, layout containment). Measured, not assumed:
 * a size container like `.st-shell` does not hold them, so a box placed from its corner lands off to the side.
 */
export function fixedOrigin(host: Element): { left: number; top: number } {
  const probe = document.createElement('i')
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none'
  host.appendChild(probe)
  const { left, top } = probe.getBoundingClientRect()
  probe.remove()
  return { left, top }
}
