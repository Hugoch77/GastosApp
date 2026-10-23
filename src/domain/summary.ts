/**
 * Cálculo del panel principal de una tarjeta.
 *
 * Supuesto: el usuario siempre paga el total de cada estado de cuenta, así que no se
 * modela saldo arrastrado ni intereses.
 *
 * - Estado facturado = cargos asignados al periodo (contado + mensualidades MSI)
 *   − devoluciones del periodo. Los pagos hechos DENTRO del periodo cubrieron el
 *   estado anterior, por eso no se restan aquí.
 * - Pago para no generar intereses = estado facturado − pagos hechos desde que
 *   empezó el periodo actual (es decir, después del corte).
 * - Una devolución de una compra a MSI se trata como un abono en su periodo.
 */
import {
  getBillingCycle,
  paymentUrgency,
  statementCutFor,
  type BillingConfig,
  type BillingCycle,
  type CutSchedule,
  type PaymentUrgency,
  type Period,
  type StatementDates,
} from './billing'
import { daysBetween, type IsoDate } from './dates'
import { installmentSchedule } from './installments'
import type { Transaction } from './types'

/** 'paid' = no hay nada pendiente por pagar del estado facturado. */
export type PaymentStatus = PaymentUrgency | 'paid'

export interface DashboardSummary {
  cycle: BillingCycle
  /** Lo que se debe hoy en total, incluido el MSI aún no facturado */
  totalBalanceCents: number
  /** Monto del estado facturado, antes de pagos */
  billedStatementCents: number
  /** Pagos hechos dentro del periodo actual (después del último corte) */
  paidSinceCutCents: number
  /** Lo que falta pagar del estado facturado para no generar intereses */
  noInterestPaymentCents: number
  /** Pagos que exceden el estado facturado */
  creditBalanceCents: number
  /** Lo acumulado en el periodo actual (contado + mensualidades del periodo) */
  currentPeriodCents: number
  /** Mensualidades MSI de periodos posteriores al actual */
  pendingInstallmentsCents: number
  daysToNextCut: number
  daysToDueDate: number
  daysToSuggestedPayment: number
  paymentStatus: PaymentStatus
}

function isWithin(date: IsoDate, period: Period): boolean {
  return date >= period.start && date <= period.end
}

function sumCents(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

/** Lo que un cargo aporta al estado que cierra en `cutDate`. */
export function chargeAmountForStatement(
  transaction: Transaction,
  cutDate: IsoDate,
  schedule: CutSchedule,
): number {
  if (transaction.type !== 'charge') return 0

  if (transaction.installments) {
    const installment = installmentSchedule(
      transaction.date,
      transaction.amountCents,
      transaction.installments.months,
      schedule,
    ).find((payment) => payment.cutDate === cutDate)
    return installment?.amountCents ?? 0
  }

  return statementCutFor(transaction.date, schedule) === cutDate
    ? transaction.amountCents
    : 0
}

/** Cargos asignados al estado − devoluciones del periodo. Puede ser negativo. */
export function statementTotalCents(
  transactions: Transaction[],
  statement: StatementDates,
  schedule: CutSchedule,
): number {
  const charges = sumCents(
    transactions.map((t) =>
      chargeAmountForStatement(t, statement.cutDate, schedule),
    ),
  )
  const refunds = sumCents(
    transactions
      .filter((t) => t.type === 'refund' && isWithin(t.date, statement.period))
      .map((t) => t.amountCents),
  )
  return charges - refunds
}

export function totalBalanceCents(transactions: Transaction[]): number {
  return sumCents(
    transactions.map((t) =>
      t.type === 'charge' ? t.amountCents : -t.amountCents,
    ),
  )
}

/** Mensualidades MSI que caen en estados posteriores a `cutDate`. */
export function pendingInstallmentsCents(
  transactions: Transaction[],
  cutDate: IsoDate,
  schedule: CutSchedule,
): number {
  return sumCents(
    transactions
      .flatMap((t) =>
        t.type === 'charge' && t.installments
          ? installmentSchedule(
              t.date,
              t.amountCents,
              t.installments.months,
              schedule,
            )
          : [],
      )
      .filter((payment) => payment.cutDate > cutDate)
      .map((payment) => payment.amountCents),
  )
}

export function getDashboardSummary(
  today: IsoDate,
  config: BillingConfig,
  transactions: Transaction[],
): DashboardSummary {
  const cycle = getBillingCycle(today, config)
  const { billed, current } = cycle

  const billedStatementCents = statementTotalCents(transactions, billed, config)
  const paidSinceCutCents = sumCents(
    transactions
      .filter((t) => t.type === 'payment' && t.date >= current.period.start)
      .map((t) => t.amountCents),
  )
  const noInterestPaymentCents = Math.max(
    0,
    billedStatementCents - paidSinceCutCents,
  )

  return {
    cycle,
    totalBalanceCents: totalBalanceCents(transactions),
    billedStatementCents,
    paidSinceCutCents,
    noInterestPaymentCents,
    creditBalanceCents: Math.max(0, paidSinceCutCents - billedStatementCents),
    currentPeriodCents: statementTotalCents(transactions, current, config),
    pendingInstallmentsCents: pendingInstallmentsCents(
      transactions,
      current.cutDate,
      config,
    ),
    daysToNextCut: daysBetween(today, current.cutDate),
    daysToDueDate: daysBetween(today, billed.dueDate),
    daysToSuggestedPayment: daysBetween(today, billed.suggestedPaymentDate),
    paymentStatus:
      noInterestPaymentCents === 0 ? 'paid' : paymentUrgency(today, billed),
  }
}
