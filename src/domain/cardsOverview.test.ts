import { describe, expect, it } from 'vitest'
import type { BillingConfig } from './billing'
import { getCardsOverview, type CardOverviewInput } from './cardsOverview'
import type { Transaction, TransactionType } from './types'

// Martes 20 de octubre de 2026.
const TODAY = '2026-10-20'

// Corte 15 / pago 5 → facturado cierra 2026-10-15, sugerida 2026-11-03.
const CUT_15: BillingConfig = {
  cutDay: 15,
  cutDayInNextPeriod: false,
  dueDay: 5,
  paymentBufferDays: 2,
}
// Corte 5 / pago 25 → facturado cierra 2026-10-05, sugerida 2026-10-23.
const CUT_5: BillingConfig = {
  cutDay: 5,
  cutDayInNextPeriod: true,
  dueDay: 25,
  paymentBufferDays: 2,
}

let nextId = 1
function tx(
  type: TransactionType,
  date: string,
  amountCents: number,
  months?: number,
): Transaction {
  return {
    id: String(nextId++),
    type,
    date,
    amountCents,
    installments: months ? { months } : null,
  }
}

function card(
  name: string,
  config: BillingConfig,
  transactions: Transaction[],
): CardOverviewInput {
  return { id: name, name, config, transactions }
}

describe('getCardsOverview', () => {
  it('suma los montos de todas las tarjetas', () => {
    const overview = getCardsOverview(TODAY, [
      card('Azul', CUT_15, [
        tx('charge', '2026-10-01', 50000), // facturado
        tx('charge', '2026-10-18', 10000), // periodo actual
      ]),
      card('Oro', CUT_5, [
        tx('charge', '2026-09-20', 30000, 3), // MSI: 100 facturado, 100 actual, 100 por facturar
        tx('payment', '2026-10-10', 5000), // pago después del corte
      ]),
    ])

    expect(overview.noInterestPaymentCents).toBe(50000 + (10000 - 5000))
    expect(overview.totalBalanceCents).toBe(60000 + (30000 - 5000))
    expect(overview.pendingInstallmentsCents).toBe(10000)
    expect(overview.rows.map((r) => r.summary.noInterestPaymentCents)).toEqual([
      5000, 50000,
    ])
  })

  it.each([
    [
      'lo más urgente primero: fecha sugerida más próxima',
      [
        card('Azul', CUT_15, [tx('charge', '2026-10-01', 100)]),
        card('Oro', CUT_5, [tx('charge', '2026-09-20', 100)]),
      ],
      ['Oro', 'Azul'],
    ],
    [
      'las que están al corriente van al final',
      [
        card('Oro', CUT_5, []),
        card('Azul', CUT_15, [tx('charge', '2026-10-01', 100)]),
      ],
      ['Azul', 'Oro'],
    ],
    [
      'con la misma fecha, por nombre',
      [
        card('Ámbar', CUT_15, [tx('charge', '2026-10-01', 100)]),
        card('Zafiro', CUT_15, [tx('charge', '2026-10-01', 100)]),
        card('Azul', CUT_15, [tx('charge', '2026-10-01', 100)]),
      ],
      ['Ámbar', 'Azul', 'Zafiro'],
    ],
    [
      'al corriente, por nombre',
      [card('Zafiro', CUT_15, []), card('Azul', CUT_5, [])],
      ['Azul', 'Zafiro'],
    ],
  ])('%s', (_case, cards, expectedOrder) => {
    expect(getCardsOverview(TODAY, cards).rows.map((r) => r.name)).toEqual(
      expectedOrder,
    )
  })

  it('sin tarjetas regresa totales en cero', () => {
    expect(getCardsOverview(TODAY, [])).toEqual({
      rows: [],
      noInterestPaymentCents: 0,
      totalBalanceCents: 0,
      pendingInstallmentsCents: 0,
    })
  })
})
