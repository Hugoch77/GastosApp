import type { PaymentStatus } from '../domain/summary'

const STATUS_BADGE: Record<
  PaymentStatus,
  { label: string; className: string }
> = {
  paid: {
    label: 'Al corriente',
    className:
      'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  'on-track': {
    label: 'A tiempo',
    className:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  },
  'due-soon': {
    label: 'Paga pronto',
    className:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  },
  'past-suggested': {
    label: 'Paga ya',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  },
  overdue: { label: 'Vencido', className: 'bg-red-600 text-white' },
}

interface Props {
  status: PaymentStatus
  testId?: string
}

/** Semáforo del pago: "A tiempo", "Paga pronto", "Paga ya", "Vencido" o "Al corriente". */
export function PaymentStatusBadge({ status, testId }: Props) {
  const badge = STATUS_BADGE[status]
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
      data-testid={testId}
      data-status={status}
    >
      {badge.label}
    </span>
  )
}
