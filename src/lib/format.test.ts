import { describe, expect, it } from 'vitest'
import {
  formatDateWithYear,
  formatLongDate,
  formatMonth,
  formatMonthYear,
  formatRelativeDays,
  formatShortDate,
  formatTimestamp,
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

describe('formatTimestamp', () => {
  it.each([
    [
      'hoy por la tarde',
      '2026-10-24T21:42:00.000Z',
      '2026-10-24',
      'hoy, 3:42 p.m.',
    ],
    [
      'otro día',
      '2026-10-23T15:05:00.000Z',
      '2026-10-24',
      '23 oct 2026, 9:05 a.m.',
    ],
    // 2:30 UTC del 25 = 20:30 del 24 en la CDMX: sigue siendo "hoy".
    [
      'de noche en UTC pero hoy en CDMX',
      '2026-10-25T02:30:00.000Z',
      '2026-10-24',
      'hoy, 8:30 p.m.',
    ],
  ])('%s', (_case, timestamp, today, expected) => {
    expect(formatTimestamp(timestamp, today)).toBe(expected)
  })
})
