import { describe, expect, it } from 'vitest'
import type { BillingConfig } from './billing'
import {
  chargeAmountForStatement,
  getDashboardSummary,
  pendingInstallmentsCents,
  statementTotalCents,
} from './summary'
import type { Transaction, TransactionType } from './types'

// Corte día 15, pago día 5, pagar 2 días antes.
// Hoy 2026-10-20 → facturado: 2026-09-16..2026-10-15 (límite 2026-11-05, sugerida 2026-11-03)
//                → actual:    2026-10-16..2026-11-15
const config: BillingConfig = {
  cutDay: 15,
  cutDayInNextPeriod: false,
  dueDay: 5,
  paymentBufferDays: 2,
}
const TODAY = '2026-10-20'

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

const baseScenario: Transaction[] = [
  tx('charge', '2026-09-20', 50000), // facturado
  tx('charge', '2026-10-15', 20000), // día de corte → facturado
  tx('charge', '2026-10-01', 90000, 3), // MSI: 300 facturado, 300 actual, 300 pendiente
  tx('refund', '2026-10-05', 10000), // devolución en facturado
  tx('charge', '2026-10-18', 15000), // actual
  tx('payment', '2026-10-19', 40000), // pago posterior al corte
]

describe('chargeAmountForStatement', () => {
  it('contado: aporta todo al estado de su periodo y nada a otros', () => {
    const charge = tx('charge', '2026-10-15', 20000)
    expect(chargeAmountForStatement(charge, '2026-10-15', config)).toBe(20000)
    expect(chargeAmountForStatement(charge, '2026-11-15', config)).toBe(0)
  })

  it('MSI: aporta solo la mensualidad de ese estado', () => {
    const msi = tx('charge', '2026-10-01', 100000, 3)
    expect(chargeAmountForStatement(msi, '2026-10-15', config)).toBe(33334)
    expect(chargeAmountForStatement(msi, '2026-11-15', config)).toBe(33333)
    expect(chargeAmountForStatement(msi, '2027-01-15', config)).toBe(0)
  })

  it('pagos y devoluciones no son cargos', () => {
    expect(
      chargeAmountForStatement(
        tx('payment', '2026-10-01', 500),
        '2026-10-15',
        config,
      ),
    ).toBe(0)
    expect(
      chargeAmountForStatement(
        tx('refund', '2026-10-01', 500),
        '2026-10-15',
        config,
      ),
    ).toBe(0)
  })
})

describe('statementTotalCents', () => {
  const billed = {
    cutDate: '2026-10-15',
    period: { start: '2026-09-16', end: '2026-10-15' },
  }

  it('cargos del periodo − devoluciones del periodo', () => {
    expect(statementTotalCents(baseScenario, billed, config)).toBe(90000)
  })

  it('puede ser negativo si las devoluciones superan a los cargos', () => {
    expect(
      statementTotalCents([tx('refund', '2026-10-01', 5000)], billed, config),
    ).toBe(-5000)
  })
})

describe('pendingInstallmentsCents', () => {
  it('suma solo mensualidades de estados posteriores al corte dado', () => {
    expect(pendingInstallmentsCents(baseScenario, '2026-11-15', config)).toBe(
      30000,
    )
    expect(pendingInstallmentsCents(baseScenario, '2026-10-15', config)).toBe(
      60000,
    )
    expect(pendingInstallmentsCents(baseScenario, '2026-12-15', config)).toBe(0)
  })
})

describe('getDashboardSummary', () => {
  it('escenario completo', () => {
    const summary = getDashboardSummary(TODAY, config, baseScenario)

    expect(summary).toMatchObject({
      billedStatementCents: 90000, // 500 + 200 + 300 (MSI) − 100
      paidSinceCutCents: 40000,
      noInterestPaymentCents: 50000,
      creditBalanceCents: 0,
      currentPeriodCents: 45000, // 150 + 300 (MSI)
      pendingInstallmentsCents: 30000,
      totalBalanceCents: 125000, // 1750 cargos − 100 devolución − 400 pago
      daysToNextCut: 26,
      daysToDueDate: 16,
      daysToSuggestedPayment: 14,
      paymentStatus: 'on-track',
    })
    expect(summary.cycle.billed.dueDate).toBe('2026-11-05')
    expect(summary.cycle.billed.suggestedPaymentDate).toBe('2026-11-03')
  })

  it('el saldo total cuadra con: pendiente facturado + periodo actual + MSI futuro', () => {
    const s = getDashboardSummary(TODAY, config, baseScenario)
    expect(s.totalBalanceCents).toBe(
      s.noInterestPaymentCents +
        s.currentPeriodCents +
        s.pendingInstallmentsCents,
    )
  })

  it('los pagos hechos dentro del periodo facturado no reducen el pago sin intereses', () => {
    const transactions = [...baseScenario, tx('payment', '2026-10-03', 75000)]
    expect(
      getDashboardSummary(TODAY, config, transactions).noInterestPaymentCents,
    ).toBe(50000)
  })

  it('pago completo → estado "paid"', () => {
    const transactions = [...baseScenario, tx('payment', '2026-10-25', 50000)]
    const summary = getDashboardSummary('2026-10-26', config, transactions)
    expect(summary.noInterestPaymentCents).toBe(0)
    expect(summary.creditBalanceCents).toBe(0)
    expect(summary.paymentStatus).toBe('paid')
  })

  it('sobrepago → saldo a favor', () => {
    const transactions = [...baseScenario, tx('payment', '2026-10-25', 60000)]
    const summary = getDashboardSummary('2026-10-26', config, transactions)
    expect(summary.noInterestPaymentCents).toBe(0)
    expect(summary.creditBalanceCents).toBe(10000)
  })

  it('devolución mayor que los cargos del periodo → saldo a favor', () => {
    const summary = getDashboardSummary(TODAY, config, [
      tx('refund', '2026-10-01', 5000),
    ])
    expect(summary.noInterestPaymentCents).toBe(0)
    expect(summary.creditBalanceCents).toBe(5000)
    expect(summary.paymentStatus).toBe('paid')
  })

  it.each([
    ['2026-10-29', 'due-soon'], // faltan 5 días para la sugerida
    ['2026-11-04', 'past-suggested'],
    ['2026-11-05', 'past-suggested'], // último día
    ['2026-11-06', 'overdue'],
  ])('sin pagar, hoy %s → %s', (today, expected) => {
    expect(getDashboardSummary(today, config, baseScenario).paymentStatus).toBe(
      expected,
    )
  })

  it('el día de corte, el cargo de hoy sigue en el periodo actual', () => {
    const summary = getDashboardSummary('2026-10-15', config, [
      tx('charge', '2026-10-15', 20000),
    ])
    expect(summary.currentPeriodCents).toBe(20000)
    expect(summary.billedStatementCents).toBe(0)
    expect(summary.daysToNextCut).toBe(0)
  })

  it('al día siguiente del corte, ese cargo pasa al facturado', () => {
    const summary = getDashboardSummary('2026-10-16', config, [
      tx('charge', '2026-10-15', 20000),
    ])
    expect(summary.currentPeriodCents).toBe(0)
    expect(summary.billedStatementCents).toBe(20000)
    expect(summary.noInterestPaymentCents).toBe(20000)
  })

  describe('banco que pasa el día de corte al siguiente estado', () => {
    // Corte 5, pago 25 → facturado 2026-09-05..2026-10-04, límite 2026-10-25
    const bbva: BillingConfig = {
      cutDay: 5,
      cutDayInNextPeriod: true,
      dueDay: 25,
      paymentBufferDays: 2,
    }

    it('el cargo del día de corte va al periodo actual y el pago de ese día cuenta para el facturado', () => {
      const summary = getDashboardSummary('2026-10-05', bbva, [
        tx('charge', '2026-10-04', 30000),
        tx('charge', '2026-10-05', 20000),
        tx('payment', '2026-10-05', 30000),
      ])
      expect(summary.billedStatementCents).toBe(30000)
      expect(summary.currentPeriodCents).toBe(20000)
      expect(summary.paidSinceCutCents).toBe(30000)
      expect(summary.paymentStatus).toBe('paid')
    })

    it('el día de corte ya no dice "Corta hoy": el ciclo nuevo empezó', () => {
      const summary = getDashboardSummary('2026-10-05', bbva, [])
      expect(summary.cycle.isCutDay).toBe(false)
      expect(summary.daysToNextCut).toBe(31)
    })
  })

  it('sin movimientos todo es cero y no hay nada que pagar', () => {
    const summary = getDashboardSummary(TODAY, config, [])
    expect(summary.totalBalanceCents).toBe(0)
    expect(summary.noInterestPaymentCents).toBe(0)
    expect(summary.paymentStatus).toBe('paid')
  })
})
