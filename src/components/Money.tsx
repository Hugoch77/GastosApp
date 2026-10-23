import { formatMXN } from '../domain/money'

interface Props {
  cents: number
  /** Abonos (pagos y devoluciones): se muestran en verde con signo menos. */
  credit?: boolean
  className?: string
  testId?: string
}

export function Money({
  cents,
  credit = false,
  className = '',
  testId,
}: Props) {
  const tone = credit ? 'text-emerald-600 dark:text-emerald-400' : ''
  return (
    <span className={`tabular-nums ${tone} ${className}`} data-testid={testId}>
      {credit ? `−${formatMXN(cents)}` : formatMXN(cents)}
    </span>
  )
}
