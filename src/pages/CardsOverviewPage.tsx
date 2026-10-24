import { useNavigate } from 'react-router'
import { Money } from '../components/Money'
import { PageHeader } from '../components/PageHeader'
import { PaymentStatusBadge } from '../components/PaymentStatusBadge'
import { ui } from '../components/styles'
import {
  activeCards,
  billingConfigFor,
  transactionsForCard,
} from '../data/selectors'
import { getCardsOverview, type CardOverviewRow } from '../domain/cardsOverview'
import { useToday } from '../hooks/useToday'
import { formatRelativeDays, formatShortDate } from '../lib/format'
import { useGastos } from '../state/gastosContext'

/** Ruta /tarjetas: lo que hay que pagar en cada tarjeta, lo más urgente arriba. */
export function CardsOverviewPage() {
  const today = useToday()
  const { data, mutate } = useGastos()
  const navigate = useNavigate()
  const overview = getCardsOverview(
    today,
    activeCards(data).map((card) => ({
      id: card.id,
      name: card.name,
      config: billingConfigFor(card, data.settings),
      transactions: transactionsForCard(data, card.id),
    })),
  )

  /** Al tocar una tarjeta se selecciona y se abre su panel. */
  async function openCard(cardId: string) {
    await mutate((repo) => repo.updateSettings({ activeCardId: cardId }))
    void navigate('/')
  }

  return (
    <>
      <PageHeader title="Todas las tarjetas" backTo="/" />
      <main className="space-y-4 px-4 pb-8">
        <section className={`${ui.card} space-y-2`} data-testid="cards-totals">
          <h2 className={ui.muted}>Pago total para no generar intereses</h2>
          <Money
            cents={overview.noInterestPaymentCents}
            className="block text-3xl font-bold"
            testId="cards-total-no-interest"
          />
          <p className={ui.muted}>
            Saldo total{' '}
            <Money
              cents={overview.totalBalanceCents}
              testId="cards-total-balance"
            />{' '}
            · MSI por facturar{' '}
            <Money
              cents={overview.pendingInstallmentsCents}
              testId="cards-total-pending-installments"
            />
          </p>
        </section>

        <ul className={ui.list}>
          {overview.rows.map((row) => (
            <li key={row.id}>
              <CardRow row={row} onOpen={() => void openCard(row.id)} />
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}

function CardRow({
  row,
  onOpen,
}: {
  row: CardOverviewRow
  onOpen: () => void
}) {
  const { summary } = row
  const { billed, current } = summary.cycle

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full space-y-1 px-4 py-3 text-left active:bg-slate-100 dark:active:bg-slate-800"
      data-testid="card-overview-row"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-medium" data-testid="card-overview-name">
          {row.name}
        </span>
        <PaymentStatusBadge
          status={summary.paymentStatus}
          testId="card-overview-status"
        />
      </span>

      {summary.paymentStatus === 'paid' ? (
        <span className={`${ui.muted} block`}>
          Sin pagos pendientes del último estado de cuenta
        </span>
      ) : (
        <span className="block">
          <Money
            cents={summary.noInterestPaymentCents}
            className="text-lg font-semibold"
            testId="card-overview-amount"
          />
          <span className={`${ui.muted} block`}>
            {summary.paymentStatus === 'overdue'
              ? `La fecha límite fue el ${formatShortDate(billed.dueDate)}`
              : `Paga el ${formatShortDate(billed.suggestedPaymentDate)} · ${formatRelativeDays(summary.daysToSuggestedPayment)}`}
          </span>
        </span>
      )}

      <span className="block text-xs text-slate-500 dark:text-slate-400">
        Próximo corte {formatShortDate(current.cutDate)} · Saldo{' '}
        <Money cents={summary.totalBalanceCents} />
      </span>
    </button>
  )
}
