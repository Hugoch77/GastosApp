import { describe, expect, it } from 'vitest'
import {
  addDays,
  clampedDate,
  dayOfWeek,
  daysBetween,
  daysInMonth,
  isValidIsoDate,
  parseIsoDate,
  shiftMonth,
} from './dates'

describe('daysInMonth', () => {
  it.each([
    [2027, 2, 28],
    [2028, 2, 29], // bisiesto
    [2100, 2, 28], // divisible entre 100 pero no entre 400
    [2000, 2, 29], // divisible entre 400
    [2026, 4, 30],
    [2026, 12, 31],
  ])('%i-%i tiene %i días', (year, month, expected) => {
    expect(daysInMonth(year, month)).toBe(expected)
  })
})

describe('clampedDate', () => {
  it.each([
    [2027, 2, 31, '2027-02-28'],
    [2028, 2, 31, '2028-02-29'],
    [2026, 4, 31, '2026-04-30'],
    [2026, 3, 31, '2026-03-31'],
    [2026, 3, 15, '2026-03-15'],
  ])('%i-%i día %i → %s', (year, month, day, expected) => {
    expect(clampedDate(year, month, day)).toBe(expected)
  })
})

describe('shiftMonth', () => {
  it.each([
    [2026, 12, 1, { year: 2027, month: 1 }],
    [2026, 1, -1, { year: 2025, month: 12 }],
    [2026, 6, 0, { year: 2026, month: 6 }],
    [2026, 11, 14, { year: 2028, month: 1 }],
  ])('%i-%i %+i meses', (year, month, months, expected) => {
    expect(shiftMonth(year, month, months)).toEqual(expected)
  })
})

describe('addDays / daysBetween', () => {
  it.each([
    ['2026-12-31', 1, '2027-01-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2027-02-28', 1, '2027-03-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-10-23', 0, '2026-10-23'],
  ])('%s %+i días → %s', (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected)
    expect(daysBetween(date, expected)).toBe(days)
  })
})

describe('dayOfWeek', () => {
  it.each([
    ['2026-10-23', 5], // viernes
    ['2026-10-24', 6], // sábado
    ['2026-10-25', 0], // domingo
    ['2027-01-01', 5],
  ])('%s → %i', (date, expected) => {
    expect(dayOfWeek(date)).toBe(expected)
  })
})

describe('parseIsoDate', () => {
  it('separa año, mes y día', () => {
    expect(parseIsoDate('2026-02-09')).toEqual({ year: 2026, month: 2, day: 9 })
  })

  it.each(['2026-2-9', '2026-13-01', '2027-02-29', '2026-04-31', 'hoy', ''])(
    'rechaza "%s"',
    (value) => {
      expect(isValidIsoDate(value)).toBe(false)
      expect(() => parseIsoDate(value)).toThrow()
    },
  )
})
