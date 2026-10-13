/** One symbol of the Spark design's icon sprite (`#i-<name>`), with the design's icon classes (`sm`, `spark`). */
export function StudioIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={`i${className ? ` ${className}` : ''}`} aria-hidden>
      <use href={`#i-${name}`} />
    </svg>
  )
}
