import { Link, useSearchParams } from 'react-router'
import { CardSwitcher } from '../components/CardSwitcher'
import { Money } from '../components/Money'
import { PageHeader } from '../components/PageHeader'
import { SegmentedControl } from '../components/SegmentedControl'
import { ui } from '../components/styles'
import type { Category, Transaction } from '../data/schema'
import { transactionsForCard } from '../data/selectors'
import { getBillingCycle, type Period } from '../domain/billing'
import { statementEntries, type StatementEntry } from '../domain/statement'
import { statementTotalCents } from '../domain/summary'
import { useSelectedCard } from '../hooks/useSelectedCard'
import { useToday } from '../hooks/useToday'
import { formatShortDate } from '../lib/format'
import { useGastos } from '../state/gastosContext'

type View = 'actual' | 'facturado' | 'todos'

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: 'actual', label: 'Periodo actual' },
  { value: 'facturado', label: 'Facturado' },
  { value: 'todos', label: 'Todos' },
]

function parseView(value: string | null): View {
  return VIEW_OPTIONS.some((o) => o.value === value)
    ? (value as View)
    : 'actual'
}

export function TransactionsPage() {
  const today = useToday()
  const { data } = useGastos()
  const { card, config } = useSelectedCard()
  // La vista elegida vive en la URL (?vista=facturado) para conservarla al regresar.
  const [searchParams, setSearchParams] = useSearchParams()
  const view = parseView(searchParams.get('vista'))

  const transactions = transactionsForCard(data, card.id)
  const cycle = getBillingCycle(today, config)
  const period: Period | null =
    view === 'actual'
      ? cycle.current.period
      : view === 'facturado'
        ? cycle.billed.period
        : null

  const entries: StatementEntry<Transaction>[] = period
    ? statementEntries(transactions, period, config.cutDay)
    : transactions.map((t) => ({
        transaction: t,
        amountCents: t.amountCents,
        installment: null,
      }))

  const categories = new Map(data.categories.map((c) => [c.id, c]))

  return (
    <>
      <PageHeader title="Movimientos" right={<CardSwitcher />} />
      <main className="space-y-4 px-4">
        <SegmentedControl
          label="Periodo"
          options={VIEW_OPTIONS}
          value={view}
          onChange={(value) =>
            setSearchParams({ vista: value }, { replace: true })
          }
          testId="period-view"
        />

        {period && (
          <div className="flex items-baseline justify-between px-1">
            <p className={ui.muted} data-testid="period-range">
              {formatShortDate(period.start)} – {formatShortDate(period.end)}
            </p>
            <p className="text-sm">
              Total:{' '}
              <Money
                cents={statementTotalCents(transactions, period, config.cutDay)}
                className="font-semibold"
                testId="period-total"
              />
            </p>
          </div>
        )}

        {entries.length === 0 ? (
          <p
            className={`${ui.card} text-center ${ui.muted}`}
            data-testid="empty-list"
          >
            No hay movimientos{' '}
            {view === 'todos' ? 'registrados' : 'en este periodo'}.
          </p>
        ) : (
          <ul className={ui.list}>
            {entries.map((entry) => (
              <TransactionRow
                key={entry.transaction.id}
                entry={entry}
                category={categories.get(entry.transaction.categoryId ?? '')}
              />
            ))}
          </ul>
        )}
      </main>
    </>
  )
}

const TYPE_ICON = { payment: '💳', refund: '↩️' } as const

function TransactionRow({
  entry,
  category,
}: {
  entry: StatementEntry<Transaction>
  category: Category | undefined
}) {
  const { transaction: t, amountCents, installment } = entry
  const icon =
    t.type === 'charge' ? (category?.icon ?? '📦') : TYPE_ICON[t.type]

  const details = [formatShortDate(t.date)]
  if (t.type === 'payment') details.push('Pago')
  else if (t.type === 'refund') details.push('Devolución')
  else if (category) details.push(category.name)
  if (installment)
    details.push(`MSI ${installment.number}/${installment.months}`)
  else if (t.installments) details.push(`${t.installments.months} MSI`)

  return (
    <li>
      <Link
        to={`/movimientos/${t.id}`}
        className="flex items-center gap-3 px-4 py-3 active:bg-slate-100 dark:active:bg-slate-800"
        data-testid="transaction-row"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg dark:bg-slate-800">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="block truncate font-medium"
            data-testid="transaction-description"
          >
            {t.description}
          </span>
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
            {details.join(' · ')}
          </span>
        </span>
        <Money
          cents={amountCents}
          credit={t.type !== 'charge'}
          className="font-semibold"
          testId="transaction-amount"
        />
      </Link>
    </li>
  )
}
