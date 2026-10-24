/**
 * Compras a meses sin intereses vigentes y cuánto se pagará de MSI en los próximos estados.
 *
 * "Vigente" = le queda al menos una mensualidad en el estado actual o en uno posterior.
 * Las mensualidades de estados ya cortados se consideran facturadas.
 */
import {
  cutDateRelativeTo,
  dueDateForCut,
  type BillingConfig,
  type CutSchedule,
} from './billing'
import type { IsoDate } from './dates'
import { installmentSchedule } from './installments'
import type { Transaction } from './types'

export interface InstallmentPlan<T extends Transaction = Transaction> {
  transaction: T
  months: number
  /** Mensualidades en estados ya cortados */
  billedCount: number
  /** La próxima mensualidad (la del estado actual o la siguiente que toque) */
  nextAmountCents: number
  /** Suma de las mensualidades que faltan, incluida la del estado actual */
  remainingCents: number
  /** Corte del estado donde cae la última mensualidad */
  lastCutDate: IsoDate
}

export interface ProjectedStatement {
  cutDate: IsoDate
  dueDate: IsoDate
  /** Suma de mensualidades MSI que caen en ese estado */
  amountCents: number
}

function isInstallmentCharge(t: Transaction): boolean {
  return t.type === 'charge' && t.installments !== null
}

/**
 * MSI con mensualidades a partir del estado que cierra en `currentCut`,
 * ordenadas por la que termina primero.
 */
export function activeInstallmentPlans<T extends Transaction>(
  transactions: T[],
  currentCut: IsoDate,
  schedule: CutSchedule,
): InstallmentPlan<T>[] {
  const plans: InstallmentPlan<T>[] = []
  for (const transaction of transactions.filter(isInstallmentCharge)) {
    const months = transaction.installments?.months ?? 1
    const payments = installmentSchedule(
      transaction.date,
      transaction.amountCents,
      months,
      schedule,
    )
    const remaining = payments.filter((p) => p.cutDate >= currentCut)
    if (remaining.length === 0) continue

    plans.push({
      transaction,
      months,
      billedCount: months - remaining.length,
      nextAmountCents: remaining[0].amountCents,
      remainingCents: remaining.reduce((sum, p) => sum + p.amountCents, 0),
      lastCutDate: payments[payments.length - 1].cutDate,
    })
  }
  return plans.sort(
    (a, b) =>
      a.lastCutDate.localeCompare(b.lastCutDate) ||
      a.transaction.date.localeCompare(b.transaction.date),
  )
}

/** Mensualidades MSI de `count` estados consecutivos a partir de `firstCut`. */
export function installmentProjection(
  transactions: Transaction[],
  firstCut: IsoDate,
  count: number,
  config: BillingConfig,
): ProjectedStatement[] {
  const totals = new Map<IsoDate, number>()
  for (const t of transactions.filter(isInstallmentCharge)) {
    const months = t.installments?.months ?? 1
    for (const p of installmentSchedule(
      t.date,
      t.amountCents,
      months,
      config,
    )) {
      totals.set(p.cutDate, (totals.get(p.cutDate) ?? 0) + p.amountCents)
    }
  }

  return Array.from({ length: count }, (_, i) => {
    const cutDate = cutDateRelativeTo(firstCut, config.cutDay, i)
    return {
      cutDate,
      dueDate: dueDateForCut(cutDate, config.dueDay),
      amountCents: totals.get(cutDate) ?? 0,
    }
  })
}
