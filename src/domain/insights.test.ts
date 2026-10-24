import { describe, expect, it } from 'vitest'
import type { BillingConfig } from './billing'
import {
  spendingByCategory,
  statementHistory,
  type CategorizedTransaction,
} from './insights'
import type { TransactionType } from './types'

const config: BillingConfig = {
  cutDay: 15,
  cutDayInNextPeriod: false,
  dueDay: 5,
  paymentBufferDays: 2,
}
const october = {
  cutDate: '2026-10-15',
  period: { start: '2026-09-16', end: '2026-10-15' },
}

let nextId = 1
function tx(
  type: TransactionType,
  date: string,
  amountCents: number,
  categoryId: string | null,
  months?: number,
): CategorizedTransaction {
  return {
    id: String(nextId++),
    type,
    date,
    amountCents,
    categoryId,
    installments: months ? { months } : null,
  }
}

describe('spendingByCategory', () => {
  it('suma por categoría con mensualidades MSI y resta devoluciones; ignora pagos', () => {
    const result = spendingByCategory(
      [
        tx('charge', '2026-10-01', 30000, 'food'),
        tx('charge', '2026-10-10', 20000, 'food'),
        tx('charge', '2026-10-02', 90000, 'home', 3), // 300 en este estado
        tx('refund', '2026-10-03', 5000, 'food'),
        tx('payment', '2026-10-04', 100000, null),
        tx('charge', '2026-11-01', 99900, 'travel'), // otro estado
      ],
      october,
      config,
    )
    expect(result).toEqual([
      { categoryId: 'food', cents: 45000 },
      { categoryId: 'home', cents: 30000 },
    ])
  })

  it('omite categorías que quedan en cero o a favor', () => {
    const result = spendingByCategory(
      [
        tx('charge', '2026-10-01', 1000, 'food'),
        tx('refund', '2026-10-02', 1000, 'food'),
        tx('refund', '2026-10-03', 500, 'clothing'),
      ],
      october,
      config,
    )
    expect(result).toEqual([])
  })
})

describe('statementHistory', () => {
  it('estados consecutivos del más antiguo al más reciente con su total', () => {
    const history = statementHistory(
      [
        tx('charge', '2026-08-20', 10000, 'food'),
        tx('charge', '2026-10-01', 20000, 'food'),
        tx('refund', '2026-10-02', 5000, 'food'),
      ],
      '2026-10-15',
      3,
      config,
    )
    expect(history.map((h) => [h.statement.cutDate, h.totalCents])).toEqual([
      ['2026-08-15', 0],
      ['2026-09-15', 10000],
      ['2026-10-15', 15000],
    ])
    expect(history[2].statement.dueDate).toBe('2026-11-05')
  })
})
