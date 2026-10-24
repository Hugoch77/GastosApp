import { describe, expect, it } from 'vitest'
import type { BillingConfig } from './billing'
import {
  activeInstallmentPlans,
  installmentProjection,
} from './installmentPlans'
import type { Transaction, TransactionType } from './types'

// Corte 5 (lo del día 5 pasa al siguiente estado), pago 25.
const config: BillingConfig = {
  cutDay: 5,
  cutDayInNextPeriod: true,
  dueDay: 25,
  paymentBufferDays: 2,
}
const CURRENT_CUT = '2026-11-05' // hoy entre 2026-10-05 y 2026-11-04

function tx(
  id: string,
  date: string,
  amountCents: number,
  months: number | null,
  type: TransactionType = 'charge',
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
  tx('llantas', '2026-09-30', 922040, 6), // oct..mar: 1 facturada, 5 pendientes
  tx('lavadora', '2025-07-01', 895920, 18), // jul 2025..dic 2026: 16 facturadas
  tx('terminada', '2026-01-10', 30000, 3), // feb..abr: nada pendiente
  tx('contado', '2026-10-10', 50000, null), // no es MSI
  tx('nueva', '2026-10-20', 90000, 3), // nov..ene: todo pendiente
]

describe('activeInstallmentPlans', () => {
  it('solo MSI con mensualidades pendientes, la que termina primero arriba', () => {
    const plans = activeInstallmentPlans(transactions, CURRENT_CUT, config)
    expect(plans.map((p) => p.transaction.id)).toEqual([
      'lavadora',
      'nueva',
      'llantas',
    ])
  })

  it('calcula facturadas, próxima mensualidad, restante y último corte', () => {
    const plans = activeInstallmentPlans(transactions, CURRENT_CUT, config)
    const llantas = plans.find((p) => p.transaction.id === 'llantas')
    expect(llantas).toMatchObject({
      months: 6,
      billedCount: 1,
      nextAmountCents: 153674,
      remainingCents: 922040 - 153674,
      lastCutDate: '2027-03-05',
    })
    const lavadora = plans.find((p) => p.transaction.id === 'lavadora')
    expect(lavadora).toMatchObject({
      billedCount: 16,
      nextAmountCents: 49773,
      remainingCents: 49773 + 49773,
      lastCutDate: '2026-12-05',
    })
  })

  it('sin MSI vigentes regresa una lista vacía', () => {
    expect(activeInstallmentPlans(transactions, '2027-06-05', config)).toEqual(
      [],
    )
  })
})

describe('installmentProjection', () => {
  it('suma las mensualidades de cada estado y su fecha límite', () => {
    const projection = installmentProjection(
      transactions,
      CURRENT_CUT,
      5,
      config,
    )
    expect(projection.map((p) => [p.cutDate, p.dueDate])).toEqual([
      ['2026-11-05', '2026-11-25'],
      ['2026-12-05', '2026-12-25'],
      ['2027-01-05', '2027-01-25'],
      ['2027-02-05', '2027-02-25'],
      ['2027-03-05', '2027-03-25'],
    ])
    expect(projection.map((p) => p.amountCents)).toEqual([
      153674 + 49773 + 30000, // llantas 2, lavadora 17, nueva 1
      153673 + 49773 + 30000,
      153673 + 30000,
      153673,
      153673,
    ])
  })

  it('respeta cortes recortados a fin de mes', () => {
    const projection = installmentProjection([], '2027-01-31', 3, {
      ...config,
      cutDay: 31,
      cutDayInNextPeriod: false,
      dueDay: 20,
    })
    expect(projection.map((p) => p.cutDate)).toEqual([
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
    ])
  })
})
