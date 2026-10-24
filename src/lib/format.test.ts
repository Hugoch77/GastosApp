import { describe, expect, it } from 'vitest'
import {
  formatDateWithYear,
  formatLongDate,
  formatMonth,
  formatMonthYear,
  formatRelativeDays,
  formatShortDate,
} from './format'

describe('formatos de fecha', () => {
  it('no se recorren de día sin importar la zona horaria', () => {
    expect(formatShortDate('2026-10-26')).toBe('lun 26 de oct')
    expect(formatLongDate('2026-10-26')).toBe('lunes, 26 de octubre')
    expect(formatDateWithYear('2026-10-26')).toBe('26 oct 2026')
    expect(formatShortDate('2027-01-01')).toBe('vie 1 de ene')
    expect(formatMonthYear('2026-11-25')).toBe('nov 2026')
    expect(formatMonthYear('2027-01-01')).toBe('ene 2027')
    expect(formatMonth('2026-09-30')).toBe('sep')
  })
})

describe('formatRelativeDays', () => {
  it.each([
    [0, 'hoy'],
    [1, 'mañana'],
    [-1, 'ayer'],
    [5, 'en 5 días'],
    [-3, 'hace 3 días'],
  ])('%i → %s', (days, expected) => {
    expect(formatRelativeDays(days)).toBe(expected)
  })
})
