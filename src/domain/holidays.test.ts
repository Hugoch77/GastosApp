import { describe, expect, it } from 'vitest'
import {
  bankHolidays,
  easterSunday,
  isBusinessDay,
  nextBusinessDay,
  nthWeekdayOfMonth,
  previousBusinessDay,
} from './holidays'

describe('easterSunday', () => {
  it.each([
    [2008, '2008-03-23'],
    [2019, '2019-04-21'],
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2038, '2038-04-25'], // la fecha más tardía posible
  ])('%i → %s', (year, expected) => {
    expect(easterSunday(year)).toBe(expected)
  })
})

describe('nthWeekdayOfMonth', () => {
  it.each([
    [2026, 2, 1, 1, '2026-02-02'], // 1er lunes feb (el 1 es domingo)
    [2026, 3, 1, 3, '2026-03-16'], // 3er lunes mar
    [2026, 11, 1, 3, '2026-11-16'], // 3er lunes nov
    [2027, 2, 1, 1, '2027-02-01'], // el 1 ya es lunes
  ])('%i-%i weekday %i n=%i → %s', (year, month, weekday, n, expected) => {
    expect(nthWeekdayOfMonth(year, month, weekday, n)).toBe(expected)
  })
})

describe('bankHolidays', () => {
  it('calcula el calendario completo de 2026', () => {
    expect(bankHolidays(2026)).toEqual([
      '2026-01-01',
      '2026-02-02',
      '2026-03-16',
      '2026-04-02',
      '2026-04-03',
      '2026-05-01',
      '2026-09-16',
      '2026-11-02',
      '2026-11-16',
      '2026-12-12',
      '2026-12-25',
    ])
  })
})

describe('isBusinessDay', () => {
  it.each([
    ['2026-10-23', true], // viernes normal
    ['2026-10-24', false], // sábado
    ['2026-10-25', false], // domingo
    ['2026-11-16', false], // lunes festivo
    ['2026-04-02', false], // jueves santo
    ['2026-11-17', true],
  ])('%s → %s', (date, expected) => {
    expect(isBusinessDay(date)).toBe(expected)
  })

  it('respeta días inhábiles extra', () => {
    expect(isBusinessDay('2030-10-01')).toBe(true)
    expect(isBusinessDay('2030-10-01', ['2030-10-01'])).toBe(false)
  })
})

describe('nextBusinessDay / previousBusinessDay', () => {
  it.each([
    ['2026-10-23', '2026-10-23'], // ya es hábil
    ['2026-10-24', '2026-10-26'], // sábado → lunes
    ['2026-11-15', '2026-11-17'], // domingo + lunes festivo → martes
    ['2026-04-02', '2026-04-06'], // jueves santo → lunes de pascua
  ])('siguiente hábil de %s → %s', (date, expected) => {
    expect(nextBusinessDay(date)).toBe(expected)
  })

  it.each([
    ['2026-10-23', '2026-10-23'],
    ['2026-10-25', '2026-10-23'], // domingo → viernes
    ['2026-11-16', '2026-11-13'], // lunes festivo → viernes
    ['2027-01-01', '2026-12-31'], // año nuevo → año anterior
  ])('hábil anterior de %s → %s', (date, expected) => {
    expect(previousBusinessDay(date)).toBe(expected)
  })
})
