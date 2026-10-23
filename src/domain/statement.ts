/**
 * Renglones de un estado de cuenta, como los mostraría el banco:
 * - cargos de contado del periodo, por su monto completo;
 * - compras a MSI, solo con la mensualidad que cae en ese estado;
 * - pagos y devoluciones con fecha dentro del periodo.
 */
import { periodContaining, type Period } from './billing'
import { installmentSchedule } from './installments'
import type { Transaction } from './types'

export interface StatementEntry<T extends Transaction = Transaction> {
  transaction: T
  /** Lo que el movimiento aporta a este estado (la mensualidad, en MSI) */
  amountCents: number
  /** Solo en compras a MSI: qué mensualidad es */
  installment: { number: number; months: number } | null
}

function entryFor<T extends Transaction>(
  transaction: T,
  period: Period,
  cutDay: number,
): StatementEntry<T> | null {
  const { type, date, installments, amountCents } = transaction

  if (type !== 'charge') {
    return date >= period.start && date <= period.end
      ? { transaction, amountCents, installment: null }
      : null
  }

  if (installments) {
    const payment = installmentSchedule(
      date,
      amountCents,
      installments.months,
      cutDay,
    ).find((p) => p.cutDate === period.end)
    return payment
      ? {
          transaction,
          amountCents: payment.amountCents,
          installment: { number: payment.number, months: installments.months },
        }
      : null
  }

  return periodContaining(date, cutDay).end === period.end
    ? { transaction, amountCents, installment: null }
    : null
}

/**
 * Renglones del estado que cierra en `period.end`, del más reciente al más antiguo.
 * Es genérica para que la UI reciba de vuelta su propio tipo de movimiento completo.
 */
export function statementEntries<T extends Transaction>(
  transactions: T[],
  period: Period,
  cutDay: number,
): StatementEntry<T>[] {
  return transactions
    .map((t) => entryFor(t, period, cutDay))
    .filter((entry): entry is StatementEntry<T> => entry !== null)
    .sort((a, b) => b.transaction.date.localeCompare(a.transaction.date))
}
