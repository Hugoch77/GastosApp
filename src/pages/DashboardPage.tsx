import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { BackupReminder } from '../components/BackupReminder'
import { CardSwitcher } from '../components/CardSwitcher'
import { AlertIcon, CheckIcon } from '../components/Icons'
import { Money } from '../components/Money'
import { PageHeader } from '../components/PageHeader'
import { PaymentStatusBadge } from '../components/PaymentStatusBadge'
import { ui } from '../components/styles'
import { activeCards, transactionsForCard } from '../data/selectors'
import { getDashboardSummary, type DashboardSummary } from '../domain/summary'
import { useSelectedCard } from '../hooks/useSelectedCard'
import { useToday } from '../hooks/useToday'
import {
  formatLongDate,
  formatRelativeDays,
  formatShortDate,
} from '../lib/format'
import { useGastos } from '../state/gastosContext'

export function DashboardPage() {
  const today = useToday()
  const { data } = useGastos()
  const { card, config } = useSelectedCard()
  const summary = getDashboardSummary(
    today,
    config,
    transactionsForCard(data, card.id),
  )
  const { current, isCutDay } = summary.cycle

  return (
    <>
      <PageHeader title={card.name} right={<CardSwitcher />} />
      <main className="space-y-4 px-4">
        <BackupReminder />
        {summary.paymentStatus === 'paid' ? (
          <UpToDateHero summary={summary} />
        ) : (
          <PaymentDueHero summary={summary} />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Tile
            label="Próximo corte"
            testId="next-cut"
            value={formatShortDate(current.cutDate)}
            detail={
              isCutDay ? 'Corta hoy' : formatRelativeDays(summary.daysToNextCut)
            }
          />
          <Tile
            label="Periodo actual"
            testId="current-period"
            value={<Money cents={summary.currentPeriodCents} />}
            detail={`Se paga el ${formatShortDate(current.suggestedPaymentDate)}`}
          />
          <Tile
            label="Saldo total"
            testId="total-balance"
            value={<Money cents={summary.totalBalanceCents} />}
            detail="Incluye MSI pendientes"
          />
          <Tile
            label="MSI por facturar"
            testId="pending-installments"
            value={<Money cents={summary.pendingInstallmentsCents} />}
            detail="Después del próximo corte ›"
            to="/msi"
          />
        </div>

        <Link to="/movimientos" className={ui.buttonSecondary}>
          Ver movimientos
        </Link>
        {activeCards(data).length > 1 && (
          <Link
            to="/tarjetas"
            className={ui.buttonSecondary}
            data-testid="all-cards-link"
          >
            Ver todas las tarjetas
          </Link>
        )}
      </main>
    </>
  )
}

function PaymentDueHero({ summary }: { summary: DashboardSummary }) {
  const { billed } = summary.cycle
  const status = summary.paymentStatus

  return (
    <section className={`${ui.card} space-y-3`} data-testid="payment-hero">
      <div className="flex items-start justify-between gap-2">
        <h2 className={ui.muted}>Pago para no generar intereses</h2>
        <PaymentStatusBadge status={status} testId="payment-status" />
      </div>

      <Money
        cents={summary.noInterestPaymentCents}
        className="block text-4xl font-bold"
        testId="no-interest-amount"
      />

      {summary.paidSinceCutCents > 0 && (
        <p className={ui.muted}>
          Estado de cuenta <Money cents={summary.billedStatementCents} /> −
          pagado <Money cents={summary.paidSinceCutCents} />
        </p>
      )}

      {status === 'overdue' ? (
        <p className="flex gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertIcon className="size-5 shrink-0" />
          La fecha límite fue el {formatLongDate(billed.dueDate)}. Paga cuanto
          antes para limitar los intereses.
        </p>
      ) : (
        <div className="space-y-1 border-t border-slate-200 pt-3 dark:border-slate-800">
          <p className="font-semibold">
            Paga el{' '}
            <span data-testid="suggested-payment-date">
              {formatLongDate(billed.suggestedPaymentDate)}
            </span>
            <span className={`${ui.muted} font-normal`}>
              {' '}
              · {formatRelativeDays(summary.daysToSuggestedPayment)}
            </span>
          </p>
          <p className={ui.muted}>
            Fecha límite:{' '}
            <span data-testid="due-date">{formatLongDate(billed.dueDate)}</span>
          </p>
          {billed.effectiveDueDate !== billed.dueDate && (
            <p className={ui.muted} data-testid="effective-due-date">
              Es día inhábil: el banco acepta el pago hasta el{' '}
              {formatLongDate(billed.effectiveDueDate)}.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function UpToDateHero({ summary }: { summary: DashboardSummary }) {
  return (
    <section className={`${ui.card} space-y-2`} data-testid="payment-hero">
      <p
        className="flex items-center gap-2 text-lg font-semibold text-emerald-700 dark:text-emerald-400"
        data-testid="payment-status"
        data-status="paid"
      >
        <CheckIcon />
        Estás al corriente
      </p>
      <p className={ui.muted}>
        No tienes pagos pendientes del último estado de cuenta.
      </p>
      {summary.creditBalanceCents > 0 && (
        <p>
          Saldo a favor:{' '}
          <Money
            cents={summary.creditBalanceCents}
            className="font-semibold"
            testId="credit-balance"
          />
        </p>
      )}
    </section>
  )
}

interface TileProps {
  label: string
  value: ReactNode
  detail: string
  testId: string
  /** Si se indica, el mosaico es un enlace a esa ruta. */
  to?: string
}

function Tile({ label, value, detail, testId, to }: TileProps) {
  const content = (
    <>
      <p className={ui.muted}>{label}</p>
      <p className="text-lg font-semibold" data-testid={`${testId}-value`}>
        {value}
      </p>
      <p
        className="text-xs text-slate-500 dark:text-slate-400"
        data-testid={`${testId}-detail`}
      >
        {detail}
      </p>
    </>
  )

  const className = `${ui.card} block space-y-1`
  return to ? (
    <Link
      to={to}
      className={`${className} active:bg-slate-100 dark:active:bg-slate-800`}
      data-testid={testId}
    >
      {content}
    </Link>
  ) : (
    <div className={className} data-testid={testId}>
      {content}
    </div>
  )
}
