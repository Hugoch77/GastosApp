import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CardSwitcher } from '../components/CardSwitcher'
import { Money } from '../components/Money'
import { PageHeader } from '../components/PageHeader'
import { SegmentedControl } from '../components/SegmentedControl'
import { ui } from '../components/styles'
import type { Category, Transaction } from '../data/schema'
import { activeCategories, transactionsForCard } from '../data/selectors'
import { getBillingCycle, type Statement } from '../domain/billing'
import { matchesQuery } from '../domain/search'
import {
  entriesNetCents,
  statementEntries,
  type StatementEntry,
} from '../domain/statement'
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
  // Vista y filtros viven en la URL (?vista=facturado&q=rappi&categoria=food)
  // para conservarlos al abrir un movimiento y regresar.
  const [searchParams, setSearchParams] = useSearchParams()
  const view = parseView(searchParams.get('vista'))
  const query = searchParams.get('q') ?? ''
  const categoryFilter = searchParams.get('categoria') ?? ''
  const isFiltering = query.trim() !== '' || categoryFilter !== ''

  // React Router arma la URL nueva con los parámetros del último render (incluso
  // en su forma funcional). Si llegan dos cambios antes de que React vuelva a
  // renderizar (p. ej. borrar la búsqueda y elegir categoría), el segundo
  // pisaría al primero. Por eso se recuerdan aquí los parámetros ya enviados
  // que todavía no llegan al render.
  const pendingParams = useRef<URLSearchParams | null>(null)
  useEffect(() => {
    pendingParams.current = null
  }, [searchParams])

  function updateParams(changes: Record<string, string>) {
    const next = new URLSearchParams(pendingParams.current ?? searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    pendingParams.current = next
    setSearchParams(next, { replace: true })
  }

  const transactions = transactionsForCard(data, card.id)
  const cycle = getBillingCycle(today, config)
  const statement: Statement | null =
    view === 'actual'
      ? cycle.current
      : view === 'facturado'
        ? cycle.billed
        : null

  const periodEntries: StatementEntry<Transaction>[] = statement
    ? statementEntries(transactions, statement, config)
    : transactions.map((t) => ({
        transaction: t,
        amountCents: t.amountCents,
        installment: null,
      }))
  const entries = periodEntries.filter(
    ({ transaction: t }) =>
      matchesQuery(t.description, query) &&
      (categoryFilter === '' || t.categoryId === categoryFilter),
  )

  const categories = new Map(data.categories.map((c) => [c.id, c]))

  return (
    <>
      <PageHeader title="Movimientos" right={<CardSwitcher />} />
      <main className="space-y-4 px-4">
        <SegmentedControl
          label="Periodo"
          options={VIEW_OPTIONS}
          value={view}
          onChange={(value) => updateParams({ vista: value })}
          testId="period-view"
        />

        {/* Cuadrícula: ui.input trae w-full, así cada campo llena su columna. */}
        <div className="grid grid-cols-[1fr_9rem] gap-2">
          <input
            type="search"
            aria-label="Buscar movimientos"
            placeholder="Buscar…"
            value={query}
            onChange={(e) => updateParams({ q: e.target.value })}
            className={ui.input}
            data-testid="search-input"
          />
          <select
            aria-label="Filtrar por categoría"
            value={categoryFilter}
            onChange={(e) => updateParams({ categoria: e.target.value })}
            className={ui.input}
            data-testid="category-filter"
          >
            <option value="">Todas</option>
            {activeCategories(data).map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>

        {statement && (
          <div className="flex items-baseline justify-between px-1">
            <p className={ui.muted} data-testid="period-range">
              {formatShortDate(statement.period.start)} –{' '}
              {formatShortDate(statement.period.end)}
            </p>
            <p className="text-sm">
              Total:{' '}
              <Money
                cents={statementTotalCents(transactions, statement, config)}
                className="font-semibold"
                testId="period-total"
              />
            </p>
          </div>
        )}

        {isFiltering && (
          <div
            className="flex items-center justify-between gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm dark:bg-brand-950/50"
            data-testid="filter-summary"
          >
            <span>
              <span data-testid="filter-count">
                {entries.length === 1
                  ? '1 resultado'
                  : `${entries.length} resultados`}
              </span>
              {' · '}
              <Money
                cents={entriesNetCents(entries)}
                className="font-semibold"
                testId="filter-total"
              />
            </span>
            <button
              type="button"
              onClick={() => updateParams({ q: '', categoria: '' })}
              className="font-semibold text-brand-700 dark:text-brand-300"
              data-testid="clear-filters"
            >
              Limpiar
            </button>
          </div>
        )}

        {entries.length === 0 ? (
          <p
            className={`${ui.card} text-center ${ui.muted}`}
            data-testid="empty-list"
          >
            {isFiltering
              ? 'Ningún movimiento coincide con la búsqueda.'
              : `No hay movimientos ${view === 'todos' ? 'registrados' : 'en este periodo'}.`}
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
