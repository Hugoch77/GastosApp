import { describe, expect, it } from 'vitest'
import { statementEntries } from './statement'
import type { Transaction, TransactionType } from './types'

function tx(
  id: string,
  type: TransactionType,
  date: string,
  amountCents: number,
  months?: number,
): Transaction {
  return {
    id,
    type,
    date,
    amountCents,
    installments: months ? { months } : null,
  }
}

const transactions = [
  tx('cash-billed', 'charge', '2026-09-20', 50000),
  tx('cash-on-cut', 'charge', '2026-10-15', 20000),
  tx('msi', 'charge', '2026-10-01', 90000, 3),
  tx('refund', 'refund', '2026-10-05', 10000),
  tx('payment-in-period', 'payment', '2026-10-03', 75000),
  tx('cash-current', 'charge', '2026-10-18', 15000),
  tx('payment-current', 'payment', '2026-10-19', 40000),
]

const billed = { start: '2026-09-16', end: '2026-10-15' }
const current = { start: '2026-10-16', end: '2026-11-15' }

describe('statementEntries', () => {
  it('estado facturado: contado, mensualidad MSI, pagos y devoluciones del periodo', () => {
    const entries = statementEntries(transactions, billed, 15)
    expect(
      entries.map((e) => [e.transaction.id, e.amountCents, e.installment]),
    ).toEqual([
      ['cash-on-cut', 20000, null],
      ['refund', 10000, null],
      ['payment-in-period', 75000, null],
      ['msi', 30000, { number: 1, months: 3 }],
      ['cash-billed', 50000, null],
    ])
  })

  it('periodo actual: la segunda mensualidad de la compra a MSI', () => {
    const entries = statementEntries(transactions, current, 15)
    expect(
      entries.map((e) => [e.transaction.id, e.amountCents, e.installment]),
    ).toEqual([
      ['payment-current', 40000, null],
      ['cash-current', 15000, null],
      ['msi', 30000, { number: 2, months: 3 }],
    ])
  })

  it('una compra a MSI ya liquidada no aparece', () => {
    const later = { start: '2027-01-16', end: '2027-02-15' }
    expect(statementEntries(transactions, later, 15)).toEqual([])
  })

  it('conserva el tipo completo del movimiento (genérico)', () => {
    const withDescription = [
      { ...tx('a', 'charge', '2026-10-10', 100), description: 'Café' },
    ]
    const [entry] = statementEntries(withDescription, billed, 15)
    expect(entry.transaction.description).toBe('Café')
  })
})
