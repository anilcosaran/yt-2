import { cn } from '@/lib/utils'

/**
 * The activity indicator: eight spokes turning in the text colour (Apple's spinner), the app's waiting mark wherever a
 * skeleton would not match what is coming. Spark's parts draw the same one (`AgentSpinner`).
 */
export function ActivitySpinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      className={cn('size-4 animate-[spin_0.9s_steps(8)_infinite] motion-reduce:animate-[spin_2.4s_steps(8)_infinite]', className)}
    >
      {Array.from({ length: 8 }, (_, index) => (
        <line key={index} x1="12" y1="2.75" x2="12" y2="6.75" transform={`rotate(${index * 45} 12 12)`} opacity={0.25 + (index / 7) * 0.75} />
      ))}
    </svg>
  )
}
