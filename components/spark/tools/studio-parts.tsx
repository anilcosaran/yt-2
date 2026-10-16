/** One symbol of the studio icon sprite (`#i-<name>`). */
export function Icon({ name, size }: { name: string; size?: 'sm' }) {
  return (
    <svg className={`i${size ? ` ${size}` : ''}`} aria-hidden>
      <use href={`#i-${name}`} />
    </svg>
  )
}
