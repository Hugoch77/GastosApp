import { describe, expect, it } from 'vitest'
import { checkPaymentDate, type PaymentDateCheck } from './payments'

// Hoy: 23 nov 2026; el Periodo Actual empezó el 5 nov.
const TODAY = '2026-11-23'
const PERIOD_START = '2026-11-05'

describe('checkPaymentDate', () => {
  it.each<[string, string, PaymentDateCheck]>([
    ['hoy', '2026-11-23', 'ok'],
    ['primer día del periodo actual', '2026-11-05', 'ok'],
    ['a la mitad del periodo', '2026-11-18', 'ok'],
    ['un día antes del periodo', '2026-11-04', 'before-cut'],
    ['mañana', '2026-11-24', 'future'],
    ['vacía', '', 'invalid'],
    ['fecha inexistente', '2026-11-31', 'invalid'],
  ])('%s (%s) → %s', (_name, date, expected) => {
    expect(checkPaymentDate(date, TODAY, PERIOD_START)).toBe(expected)
  })
})
