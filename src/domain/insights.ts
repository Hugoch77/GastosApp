/**
 * Datos para las gráficas: gasto por categoría de un estado y la historia de estados.
 *
 * "Gasto" = lo que el estado cobra (contado + mensualidades MSI) − devoluciones.
 * Los pagos no son gasto y no se cuentan.
 */
import {
  cutDateRelativeTo,
  statementForCut,
  type BillingConfig,
  type CutSchedule,
  type Statement,
  type StatementDates,
} from './billing'
import { statementEntries } from './statement'
import { statementTotalCents } from './summary'
import type { Transaction } from './types'

/** Movimiento con la categoría que necesitan las gráficas. */
export interface CategorizedTransaction extends Transaction {
  categoryId: string | null
}

export interface CategorySpending {
  categoryId: string | null
  cents: number
}

export interface StatementSpending {
  statement: Statement
  totalCents: number
}

/** Gasto por categoría del estado, de mayor a menor; omite categorías en cero o a favor. */
export function spendingByCategory(
  transactions: CategorizedTransaction[],
  statement: StatementDates,
  schedule: CutSchedule,
): CategorySpending[] {
  const totals = new Map<string | null, number>()
  for (const entry of statementEntries(transactions, statement, schedule)) {
    const { type, categoryId } = entry.transaction
    if (type === 'payment') continue
    const signed = type === 'refund' ? -entry.amountCents : entry.amountCents
    totals.set(categoryId, (totals.get(categoryId) ?? 0) + signed)
  }

  return [...totals]
    .map(([categoryId, cents]) => ({ categoryId, cents }))
    .filter((item) => item.cents > 0)
    .sort((a, b) => b.cents - a.cents)
}

/**
 * Los `count` estados que terminan en `lastCut` (incluido), del más antiguo al más
 * reciente, con su gasto total.
 */
export function statementHistory(
  transactions: Transaction[],
  lastCut: Statement['cutDate'],
  count: number,
  config: BillingConfig,
): StatementSpending[] {
  return Array.from({ length: count }, (_, i) => {
    const cutDate = cutDateRelativeTo(lastCut, config.cutDay, i - count + 1)
    const statement = statementForCut(cutDate, config)
    return {
      statement,
      totalCents: statementTotalCents(transactions, statement, config),
    }
  })
}
