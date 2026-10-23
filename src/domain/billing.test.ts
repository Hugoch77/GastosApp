import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  dueDateForCut,
  getBillingCycle,
  lastCutBefore,
  nextCutOnOrAfter,
  paymentUrgency,
  periodContaining,
  periodEndingAt,
  statementForCut,
  suggestedPaymentDate,
  type BillingConfig,
} from './billing'
import { addDays, toIsoDate } from './dates'

describe('lastCutBefore / nextCutOnOrAfter', () => {
  it.each([
    // [hoy, díaCorte, últimoCorte, siguienteCorte]
    ['2026-10-10', 15, '2026-09-15', '2026-10-15'], // antes del corte
    ['2026-10-15', 15, '2026-09-15', '2026-10-15'], // el día del corte
    ['2026-10-16', 15, '2026-10-15', '2026-11-15'], // después del corte
    ['2027-02-10', 31, '2027-01-31', '2027-02-28'], // 31 en febrero
    ['2028-02-10', 31, '2028-01-31', '2028-02-29'], // 31 en febrero bisiesto
    ['2027-03-01', 31, '2027-02-28', '2027-03-31'], // día siguiente a corte recortado
    ['2026-04-05', 31, '2026-03-31', '2026-04-30'], // 31 en abril
    ['2027-01-05', 31, '2026-12-31', '2027-01-31'], // cambio de año
    ['2026-01-01', 1, '2025-12-01', '2026-01-01'], // corte el día 1
  ])(
    'hoy %s, corte día %i → último %s, siguiente %s',
    (today, cutDay, last, next) => {
      expect(lastCutBefore(today, cutDay)).toBe(last)
      expect(nextCutOnOrAfter(today, cutDay)).toBe(next)
    },
  )
})

describe('periodEndingAt / periodContaining', () => {
  it.each([
    ['2026-10-15', 15, '2026-09-16', '2026-10-15'],
    ['2027-02-28', 31, '2027-02-01', '2027-02-28'],
    ['2027-03-31', 31, '2027-03-01', '2027-03-31'],
    ['2026-01-10', 10, '2025-12-11', '2026-01-10'],
  ])(
    'periodo que cierra el %s (corte %i) va de %s a %s',
    (cut, cutDay, start, end) => {
      expect(periodEndingAt(cut, cutDay)).toEqual({ start, end })
    },
  )

  it('un movimiento hecho el día de corte pertenece al estado que cierra ese día', () => {
    expect(periodContaining('2026-10-15', 15)).toEqual({
      start: '2026-09-16',
      end: '2026-10-15',
    })
  })

  it('un movimiento del día siguiente al corte pertenece al nuevo periodo', () => {
    expect(periodContaining('2026-10-16', 15)).toEqual({
      start: '2026-10-16',
      end: '2026-11-15',
    })
  })

  it('propiedad: para cualquier día de corte los periodos son contiguos, sin huecos ni traslapes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 31 }),
        fc.integer({ min: 2000, max: 2100 }),
        fc.integer({ min: 1, max: 12 }),
        (cutDay, year, month) => {
          let period = periodContaining(toIsoDate(year, month, 1), cutDay)
          for (let i = 0; i < 36; i++) {
            const next = periodContaining(addDays(period.end, 1), cutDay)
            expect(next.start).toBe(addDays(period.end, 1))
            expect(next.start <= next.end).toBe(true)
            // cualquier día dentro del periodo debe resolver a ese mismo periodo
            expect(periodContaining(next.start, cutDay)).toEqual(next)
            expect(periodContaining(next.end, cutDay)).toEqual(next)
            period = next
          }
        },
      ),
    )
  })
})

describe('dueDateForCut', () => {
  it.each([
    ['2026-10-25', 15, '2026-11-15'], // pago < corte → mes siguiente
    ['2026-10-05', 25, '2026-10-25'], // pago > corte → mismo mes
    ['2026-10-15', 15, '2026-11-15'], // mismo día → mes siguiente
    ['2026-12-20', 9, '2027-01-09'], // cambio de año
    ['2027-02-28', 28, '2027-03-28'], // corte recortado coincide con el día de pago
    ['2026-04-30', 31, '2026-05-31'], // pago 31 tras corte recortado en abril
    ['2026-01-31', 30, '2026-02-28'], // pago 30 recortado en febrero
    ['2027-01-10', 30, '2027-01-30'],
  ])('corte %s, día de pago %i → %s', (cut, dueDay, expected) => {
    expect(dueDateForCut(cut, dueDay)).toBe(expected)
  })
})

describe('suggestedPaymentDate (2 días antes, ajustado al hábil anterior)', () => {
  it.each([
    ['2026-11-04', '2026-10-30'], // → lunes 2 nov festivo → viernes 30
    ['2026-10-28', '2026-10-26'], // miércoles → lunes, sin ajuste
    ['2026-10-26', '2026-10-23'], // lunes → sábado → viernes
    ['2026-11-18', '2026-11-13'], // → lunes 16 festivo → viernes 13
    ['2026-12-14', '2026-12-11'], // → sábado 12 dic → viernes 11
    ['2027-01-03', '2026-12-31'], // → 1 ene festivo → 31 dic
  ])('fecha límite %s → pagar el %s', (dueDate, expected) => {
    expect(suggestedPaymentDate(dueDate, 2)).toBe(expected)
  })
})

describe('statementForCut', () => {
  const config: BillingConfig = { cutDay: 31, dueDay: 20, paymentBufferDays: 2 }

  it('fecha límite en domingo: la nominal se conserva y la efectiva pasa al lunes', () => {
    // corte 2026-08-31 → límite domingo 2026-09-20
    expect(statementForCut('2026-08-31', config)).toEqual({
      period: { start: '2026-08-01', end: '2026-08-31' },
      cutDate: '2026-08-31',
      dueDate: '2026-09-20',
      effectiveDueDate: '2026-09-21',
      suggestedPaymentDate: '2026-09-18',
    })
  })

  it('usa los días inhábiles extra de la configuración', () => {
    const statement = statementForCut('2026-08-31', {
      ...config,
      extraHolidays: ['2026-09-21'],
    })
    expect(statement.effectiveDueDate).toBe('2026-09-22')
  })
})

describe('getBillingCycle', () => {
  const config: BillingConfig = { cutDay: 15, dueDay: 5, paymentBufferDays: 2 }

  it('antes del corte: facturado = ciclo anterior, actual cierra este mes', () => {
    const cycle = getBillingCycle('2026-10-10', config)
    expect(cycle.billed.period).toEqual({
      start: '2026-08-16',
      end: '2026-09-15',
    })
    expect(cycle.billed.dueDate).toBe('2026-10-05')
    expect(cycle.current.period).toEqual({
      start: '2026-09-16',
      end: '2026-10-15',
    })
    expect(cycle.current.dueDate).toBe('2026-11-05')
    expect(cycle.isCutDay).toBe(false)
  })

  it('el día del corte el ciclo sigue siendo el actual', () => {
    const cycle = getBillingCycle('2026-10-15', config)
    expect(cycle.isCutDay).toBe(true)
    expect(cycle.current.cutDate).toBe('2026-10-15')
    expect(cycle.billed.cutDate).toBe('2026-09-15')
  })

  it('al día siguiente del corte ese ciclo pasa a facturado', () => {
    const cycle = getBillingCycle('2026-10-16', config)
    expect(cycle.isCutDay).toBe(false)
    expect(cycle.billed.period).toEqual({
      start: '2026-09-16',
      end: '2026-10-15',
    })
    expect(cycle.current.period).toEqual({
      start: '2026-10-16',
      end: '2026-11-15',
    })
  })

  it('corte 31 con hoy en febrero', () => {
    const cycle = getBillingCycle('2027-02-10', {
      cutDay: 31,
      dueDay: 20,
      paymentBufferDays: 2,
    })
    expect(cycle.current.cutDate).toBe('2027-02-28')
    expect(cycle.current.dueDate).toBe('2027-03-20')
    expect(cycle.billed.cutDate).toBe('2027-01-31')
    expect(cycle.billed.dueDate).toBe('2027-02-20')
  })
})

describe('paymentUrgency', () => {
  // límite miércoles 2026-10-28 → sugerida lunes 2026-10-26
  const statement = statementForCut('2026-10-08', {
    cutDay: 8,
    dueDay: 28,
    paymentBufferDays: 2,
  })

  it.each([
    ['2026-10-20', 'on-track'], // faltan 6 días para la sugerida
    ['2026-10-21', 'due-soon'], // faltan 5
    ['2026-10-26', 'due-soon'], // es el día sugerido
    ['2026-10-27', 'past-suggested'],
    ['2026-10-28', 'past-suggested'], // último día para pagar
    ['2026-10-29', 'overdue'],
  ])('hoy %s → %s', (today, expected) => {
    expect(statement.suggestedPaymentDate).toBe('2026-10-26')
    expect(paymentUrgency(today, statement)).toBe(expected)
  })
})
