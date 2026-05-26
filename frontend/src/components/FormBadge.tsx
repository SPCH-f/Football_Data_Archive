/**
 * FormBadge — visual W/D/L indicator for last 5 results.
 */

interface FormBadgeProps {
  form: string[]
}

export default function FormBadge({ form }: FormBadgeProps) {
  if (!form || form.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      {form.slice(0, 5).map((result, i) => {
        let className = ''
        let label = ''

        switch (result.toUpperCase()) {
          case 'W':
            className = 'badge-win'
            label = 'W'
            break
          case 'D':
            className = 'badge-draw'
            label = 'D'
            break
          case 'L':
            className = 'badge-loss'
            label = 'L'
            break
          default:
            className = 'inline-flex items-center justify-center w-7 h-7 rounded-full bg-stadium-700/50 text-stadium-400 text-xs font-bold'
            label = '?'
        }

        return (
          <span key={i} className={className}>
            {label}
          </span>
        )
      })}
    </div>
  )
}
