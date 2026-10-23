import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { installmentSchedule, splitInstallments } from './installments'
import type { CutSchedule } from './billing'

describe('splitInstallments', () => {
  it.each([
    [100000, 3, [33334, 33333, 33333]],
    [100, 3, [34, 33, 33]],
    [120000, 12, Array(12).fill(10000)],
    [5, 6, [1, 1, 1, 1, 1, 0]],
    [99999, 1, [99999]],
  ])('%i centavos a %i meses', (total, months, expected) => {
    expect(splitInstallments(total, months)).toEqual(expected)
  })

  it.each([0, -3, 2.5])('rechaza %s meses', (months) => {
    expect(() => splitInstallments(1000, months)).toThrow()
  })

  it('rechaza montos negativos o con fracciones de centavo', () => {
    expect(() => splitInstallments(-1000, 3)).toThrow()
    expect(() => splitInstallments(10.5, 3)).toThrow()
  })

  it('propiedad: suma exacta, diferencia máxima de 1 centavo entre cuotas', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000_000 }),
        fc.integer({ min: 1, max: 48 }),
        (total, months) => {
          const parts = splitInstallments(total, months)
          expect(parts).toHaveLength(months)
          expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
          expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1)
        },
      ),
    )
  })
})

describe('installmentSchedule', () => {
  const CUT_15: CutSchedule = { cutDay: 15, cutDayInNextPeriod: false }
  const CUT_31: CutSchedule = { cutDay: 31, cutDayInNextPeriod: false }

  it('la primera mensualidad cae en el estado de la compra', () => {
    expect(installmentSchedule('2026-10-10', 90000, 3, CUT_15)).toEqual([
      { number: 1, cutDate: '2026-10-15', amountCents: 30000 },
      { number: 2, cutDate: '2026-11-15', amountCents: 30000 },
      { number: 3, cutDate: '2026-12-15', amountCents: 30000 },
    ])
  })

  it('compra el día de corte: la primera mensualidad cae en ese mismo corte', () => {
    expect(installmentSchedule('2026-10-15', 90000, 3, CUT_15)[0].cutDate).toBe(
      '2026-10-15',
    )
  })

  it('compra el día siguiente al corte: empieza en el siguiente estado y cruza de año', () => {
    expect(
      installmentSchedule('2026-10-16', 90000, 3, CUT_15).map((p) => p.cutDate),
    ).toEqual(['2026-11-15', '2026-12-15', '2027-01-15'])
  })

  it('corte 31: respeta meses cortos', () => {
    expect(
      installmentSchedule('2027-01-20', 100000, 3, CUT_31).map(
        (p) => p.cutDate,
      ),
    ).toEqual(['2027-01-31', '2027-02-28', '2027-03-31'])
  })

  it('MSI ya vigente (compra antigua): los cortes se reconstruyen desde la fecha original', () => {
    const schedule = installmentSchedule('2026-03-02', 1200000, 12, CUT_15)
    expect(schedule[0].cutDate).toBe('2026-03-15')
    expect(schedule[7]).toEqual({
      number: 8,
      cutDate: '2026-10-15',
      amountCents: 100000,
    })
    expect(schedule[11].cutDate).toBe('2027-02-15')
  })

  it('banco que pasa el día de corte al siguiente estado: la compra de ese día empieza un mes después', () => {
    const bbva: CutSchedule = { cutDay: 5, cutDayInNextPeriod: true }
    expect(
      installmentSchedule('2026-10-05', 90000, 3, bbva).map((p) => p.cutDate),
    ).toEqual(['2026-11-05', '2026-12-05', '2027-01-05'])
    expect(installmentSchedule('2026-10-04', 90000, 3, bbva)[0].cutDate).toBe(
      '2026-10-05',
    )
  })
})
