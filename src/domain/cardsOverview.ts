/**
 * Resumen de todas las tarjetas: el panel de cada una y los totales.
 *
 * Orden: primero las que tienen algo por pagar, de la fecha sugerida más próxima a
 * la más lejana (lo más urgente arriba); después las que están al corriente.
 */
import type { BillingConfig } from './billing'
import { getDashboardSummary, type DashboardSummary } from './summary'
import type { Transaction } from './types'
import type { IsoDate } from './dates'

export interface CardOverviewInput {
  id: string
  name: string
  config: BillingConfig
  transactions: Transaction[]
}

export interface CardOverviewRow {
  id: string
  name: string
  summary: DashboardSummary
}

export interface CardsOverview {
  rows: CardOverviewRow[]
  /** Suma de lo que falta pagar de cada estado facturado */
  noInterestPaymentCents: number
  totalBalanceCents: number
  pendingInstallmentsCents: number
}

function compareRows(a: CardOverviewRow, b: CardOverviewRow): number {
  const aPaid = a.summary.paymentStatus === 'paid'
  const bPaid = b.summary.paymentStatus === 'paid'
  if (aPaid !== bPaid) return aPaid ? 1 : -1
  if (!aPaid) {
    const byDate = a.summary.cycle.billed.suggestedPaymentDate.localeCompare(
      b.summary.cycle.billed.suggestedPaymentDate,
    )
    if (byDate !== 0) return byDate
  }
  return a.name.localeCompare(b.name, 'es')
}

function sumOf(
  rows: CardOverviewRow[],
  pick: (summary: DashboardSummary) => number,
): number {
  return rows.reduce((total, row) => total + pick(row.summary), 0)
}

export function getCardsOverview(
  today: IsoDate,
  cards: CardOverviewInput[],
): CardsOverview {
  const rows = cards
    .map((card) => ({
      id: card.id,
      name: card.name,
      summary: getDashboardSummary(today, card.config, card.transactions),
    }))
    .sort(compareRows)

  return {
    rows,
    noInterestPaymentCents: sumOf(rows, (s) => s.noInterestPaymentCents),
    totalBalanceCents: sumOf(rows, (s) => s.totalBalanceCents),
    pendingInstallmentsCents: sumOf(rows, (s) => s.pendingInstallmentsCents),
  }
}
