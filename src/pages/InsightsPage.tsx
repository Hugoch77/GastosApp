import { useSearchParams } from 'react-router'
import { CardSwitcher } from '../components/CardSwitcher'
import { Money } from '../components/Money'
import { PageHeader } from '../components/PageHeader'
import { ui } from '../components/styles'
import type { Category } from '../data/schema'
import { transactionsForCard } from '../data/selectors'
import { getBillingCycle } from '../domain/billing'
import {
  spendingByCategory,
  statementHistory,
  type StatementSpending,
} from '../domain/insights'
import { useSelectedCard } from '../hooks/useSelectedCard'
import { useToday } from '../hooks/useToday'
import { formatMonth, formatMonthYear, formatShortDate } from '../lib/format'
import { useGastos } from '../state/gastosContext'

/** Estados de cuenta en la gráfica de historia (el último es el periodo actual). */
const HISTORY_LENGTH = 6
const CURRENT_INDEX = HISTORY_LENGTH - 1
const BILLED_INDEX = HISTORY_LENGTH - 2

/** Ruta /graficas: gasto por estado de cuenta y por categoría. */
export function InsightsPage() {
  const today = useToday()
  const { data } = useGastos()
  const { card, config } = useSelectedCard()
  // El estado elegido vive en la URL (?estado=4) para conservarlo al regresar.
  const [searchParams, setSearchParams] = useSearchParams()

  const transactions = transactionsForCard(data, card.id)
  const currentCut = getBillingCycle(today, config).current.cutDate
  const history = statementHistory(
    transactions,
    currentCut,
    HISTORY_LENGTH,
    config,
  )

  const requested = Number(searchParams.get('estado') ?? CURRENT_INDEX)
  const selectedIndex =
    Number.isInteger(requested) && requested >= 0 && requested < HISTORY_LENGTH
      ? requested
      : CURRENT_INDEX
  const selected = history[selectedIndex]

  const spending = spendingByCategory(transactions, selected.statement, config)
  const categories = new Map(data.categories.map((c) => [c.id, c]))

  return (
    <>
      <PageHeader title="Gráficas" right={<CardSwitcher />} />
      <main className="space-y-6 px-4">
        <section className="space-y-3">
          <div className="px-1">
            <h2 className={ui.sectionTitle}>Gasto por estado de cuenta</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Por mes de pago. Toca una barra para ver su detalle.
            </p>
          </div>
          <HistoryChart
            history={history}
            selectedIndex={selectedIndex}
            onSelect={(index) =>
              setSearchParams({ estado: String(index) }, { replace: true })
            }
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-2 px-1">
            <div>
              <h2 className="font-semibold" data-testid="insights-title">
                {statementLabel(selectedIndex, selected)}
              </h2>
              <p className={ui.muted} data-testid="insights-range">
                {formatShortDate(selected.statement.period.start)} –{' '}
                {formatShortDate(selected.statement.period.end)}
              </p>
            </div>
            <Money
              cents={selected.totalCents}
              className="text-lg font-semibold"
              testId="insights-total"
            />
          </div>
          <CategoryBreakdown spending={spending} categories={categories} />
        </section>
      </main>
    </>
  )
}

function statementLabel(index: number, item: StatementSpending): string {
  if (index === CURRENT_INDEX) return 'Periodo actual'
  if (index === BILLED_INDEX) return 'Facturado'
  return `Estado de ${formatMonthYear(item.statement.dueDate)}`
}

interface HistoryChartProps {
  history: StatementSpending[]
  selectedIndex: number
  onSelect: (index: number) => void
}

/** Columnas de una sola serie; la seleccionada se resalta y lleva su valor encima. */
function HistoryChart({ history, selectedIndex, onSelect }: HistoryChartProps) {
  const max = Math.max(...history.map((h) => h.totalCents), 0)

  return (
    <div className={`${ui.card} pt-6`}>
      <div className="flex h-40 items-end border-b border-slate-200 dark:border-slate-800">
        {history.map((item, index) => {
          const selected = index === selectedIndex
          const height = max > 0 ? Math.max(0, item.totalCents) / max : 0
          return (
            <button
              key={item.statement.cutDate}
              type="button"
              onClick={() => onSelect(index)}
              aria-pressed={selected}
              aria-label={`${statementLabel(index, item)}: ${formatMonthYear(item.statement.dueDate)}`}
              className="relative flex h-full flex-1 flex-col items-center justify-end"
              data-testid="history-bar"
            >
              {selected && (
                <Money
                  cents={item.totalCents}
                  className="absolute -top-5 text-xs font-semibold whitespace-nowrap"
                />
              )}
              <span
                className={`block w-6 rounded-t ${
                  selected ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
                style={{ height: `${height * 100}%` }}
              />
            </button>
          )
        })}
      </div>
      <div className="flex pt-1">
        {history.map((item, index) => (
          <span
            key={item.statement.cutDate}
            className={`flex-1 text-center text-xs ${
              index === selectedIndex
                ? 'font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {formatMonth(item.statement.dueDate)}
          </span>
        ))}
      </div>
    </div>
  )
}

interface CategoryBreakdownProps {
  spending: { categoryId: string | null; cents: number }[]
  categories: Map<string, Category>
}

function CategoryBreakdown({ spending, categories }: CategoryBreakdownProps) {
  if (spending.length === 0) {
    return (
      <p
        className={`${ui.card} text-center ${ui.muted}`}
        data-testid="insights-empty"
      >
        No hay gastos en este estado de cuenta.
      </p>
    )
  }

  const total = spending.reduce((sum, s) => sum + s.cents, 0)
  const max = spending[0].cents

  return (
    <ul className={`${ui.card} space-y-4`}>
      {spending.map(({ categoryId, cents }) => {
        const category = categoryId ? categories.get(categoryId) : undefined
        const percent = Math.round((cents / total) * 100)
        return (
          <li
            key={categoryId ?? 'none'}
            className="space-y-1.5"
            data-testid="insights-category"
          >
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate" data-testid="insights-category-name">
                {category?.icon ?? '📦'} {category?.name ?? 'Sin categoría'}
              </span>
              <span className="shrink-0">
                <Money
                  cents={cents}
                  className="font-semibold"
                  testId="insights-category-amount"
                />
                <span className="ml-2 inline-block w-9 text-right text-xs text-slate-500 dark:text-slate-400">
                  {percent}%
                </span>
              </span>
            </div>
            <span className="block h-2" aria-hidden="true">
              <span
                className="block h-full min-w-1 rounded-r bg-indigo-500"
                style={{ width: `${(cents / max) * 100}%` }}
              />
            </span>
          </li>
        )
      })}
    </ul>
  )
}
