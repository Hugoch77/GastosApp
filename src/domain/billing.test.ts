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
  statementCutFor,
  type BillingConfig,
  type CutSchedule,
} from './billing'
import { addDays, toIsoDate } from './dates'

/** Lo del día de corte entra al estado que cierra ese día. */
const sameDay = (cutDay: number): CutSchedule => ({
  cutDay,
  cutDayInNextPeriod: false,
})
/** Lo del día de corte entra al estado siguiente (el banco corta al iniciar el día). */
const nextDay = (cutDay: number): CutSchedule => ({
  cutDay,
  cutDayInNextPeriod: true,
})

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
      expect(periodEndingAt(cut, sameDay(cutDay))).toEqual({ start, end })
    },
  )

  it('un movimiento hecho el día de corte pertenece al estado que cierra ese día', () => {
    expect(periodContaining('2026-10-15', sameDay(15))).toEqual({
      start: '2026-09-16',
      end: '2026-10-15',
    })
  })

  it('un movimiento del día siguiente al corte pertenece al nuevo periodo', () => {
    expect(periodContaining('2026-10-16', sameDay(15))).toEqual({
      start: '2026-10-16',
      end: '2026-11-15',
    })
  })

  it('propiedad: con cualquier día y regla de corte los periodos son contiguos, sin huecos ni traslapes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 31 }),
        fc.boolean(),
        fc.integer({ min: 2000, max: 2100 }),
        fc.integer({ min: 1, max: 12 }),
        (cutDay, cutDayInNextPeriod, year, month) => {
          const schedule = { cutDay, cutDayInNextPeriod }
          let period = periodContaining(toIsoDate(year, month, 1), schedule)
          for (let i = 0; i < 36; i++) {
            const next = periodContaining(addDays(period.end, 1), schedule)
            expect(next.start).toBe(addDays(period.end, 1))
            expect(next.start <= next.end).toBe(true)
            // cualquier día dentro del periodo debe resolver a ese mismo periodo
            expect(periodContaining(next.start, schedule)).toEqual(next)
            expect(periodContaining(next.end, schedule)).toEqual(next)
            period = next
          }
        },
      ),
    )
  })
})

describe('regla "el día de corte entra al estado siguiente"', () => {
  it.each([
    // [corte, díaCorte, inicio, fin]
    ['2026-10-05', 5, '2026-09-05', '2026-10-04'],
    ['2027-02-28', 31, '2027-01-31', '2027-02-27'], // 31 recortado en febrero
    ['2027-03-31', 31, '2027-02-28', '2027-03-30'],
    ['2026-01-01', 1, '2025-12-01', '2025-12-31'], // cruza de año
  ])(
    'periodo que cierra el %s (corte %i) va de %s a %s',
    (cut, cutDay, start, end) => {
      expect(periodEndingAt(cut, nextDay(cutDay))).toEqual({ start, end })
    },
  )

  it.each([
    ['2026-10-04', '2026-10-05'], // día antes del corte → ese corte
    ['2026-10-05', '2026-11-05'], // día de corte → el siguiente
    ['2026-10-06', '2026-11-05'],
  ])('movimiento del %s → estado que corta el %s', (date, cut) => {
    expect(statementCutFor(date, nextDay(5))).toBe(cut)
  })

  it('con la regla normal el día de corte se queda en ese corte', () => {
    expect(statementCutFor('2026-10-05', sameDay(5))).toBe('2026-10-05')
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
  const config: BillingConfig = {
    cutDay: 31,
    cutDayInNextPeriod: false,
    dueDay: 20,
    paymentBufferDays: 2,
  }

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
  const config: BillingConfig = {
    cutDay: 15,
    cutDayInNextPeriod: false,
    dueDay: 5,
    paymentBufferDays: 2,
  }

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
      cutDayInNextPeriod: false,
      dueDay: 20,
      paymentBufferDays: 2,
    })
    expect(cycle.current.cutDate).toBe('2027-02-28')
    expect(cycle.current.dueDate).toBe('2027-03-20')
    expect(cycle.billed.cutDate).toBe('2027-01-31')
    expect(cycle.billed.dueDate).toBe('2027-02-20')
  })

  describe('banco que pasa el día de corte al siguiente estado (corte 5, pago 25)', () => {
    const bbva: BillingConfig = {
      cutDay: 5,
      cutDayInNextPeriod: true,
      dueDay: 25,
      paymentBufferDays: 2,
    }

    it('a mitad del ciclo', () => {
      const cycle = getBillingCycle('2026-10-23', bbva)
      expect(cycle.billed.period).toEqual({
        start: '2026-09-05',
        end: '2026-10-04',
      })
      expect(cycle.billed.dueDate).toBe('2026-10-25')
      expect(cycle.billed.suggestedPaymentDate).toBe('2026-10-23')
      expect(cycle.current.period).toEqual({
        start: '2026-10-05',
        end: '2026-11-04',
      })
    })

    it('el día de corte el estado ya cerró y empieza el ciclo nuevo', () => {
      const cycle = getBillingCycle('2026-11-05', bbva)
      expect(cycle.billed.cutDate).toBe('2026-11-05')
      expect(cycle.current.cutDate).toBe('2026-12-05')
      expect(cycle.isCutDay).toBe(false)
    })

    it('el día anterior al corte sigue en el ciclo que cierra mañana', () => {
      const cycle = getBillingCycle('2026-11-04', bbva)
      expect(cycle.current.cutDate).toBe('2026-11-05')
      expect(cycle.billed.cutDate).toBe('2026-10-05')
    })
  })
})

describe('paymentUrgency', () => {
  // límite miércoles 2026-10-28 → sugerida lunes 2026-10-26
  const statement = statementForCut('2026-10-08', {
    cutDay: 8,
    cutDayInNextPeriod: false,
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
