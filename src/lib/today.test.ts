import { describe, expect, it } from 'vitest'
import { todayInMexico } from './today'

describe('todayInMexico', () => {
  it.each([
    // [instante UTC, fecha en CDMX]
    ['2026-10-24T05:30:00Z', '2026-10-23'], // 23:30 en CDMX: sigue siendo el día anterior
    ['2026-10-24T06:00:00Z', '2026-10-24'], // medianoche en CDMX (UTC-6)
    ['2027-01-01T03:00:00Z', '2026-12-31'], // cambio de año
  ])('%s → %s', (instant, expected) => {
    expect(todayInMexico(new Date(instant))).toBe(expected)
  })
})
