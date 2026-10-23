/**
 * Días inhábiles bancarios en México, calculados por REGLA (sin listas por año).
 *
 * Calendario base de la CNBV:
 *   1 ene, primer lunes de febrero, tercer lunes de marzo, jueves y viernes santos,
 *   1 may, 16 sep, 2 nov, tercer lunes de noviembre, 12 dic y 25 dic.
 * Los días extraordinarios (p. ej. el 1 de octubre en año de cambio de gobierno)
 * se reciben en `extraHolidays`, configurables por el usuario.
 */
import { addDays, dayOfWeek, toIsoDate, type IsoDate } from './dates'

const MONDAY = 1

/** Domingo de Pascua (algoritmo anónimo gregoriano de Meeus/Jones/Butcher). */
export function easterSunday(year: number): IsoDate {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return toIsoDate(year, month, day)
}

/** El n-ésimo día `weekday` (0 = domingo) del mes. Ej.: tercer lunes de marzo. */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number,
): IsoDate {
  const firstOfMonth = toIsoDate(year, month, 1)
  const offsetToFirst = (weekday - dayOfWeek(firstOfMonth) + 7) % 7
  return addDays(firstOfMonth, offsetToFirst + (n - 1) * 7)
}

export function bankHolidays(year: number): IsoDate[] {
  const easter = easterSunday(year)
  return [
    toIsoDate(year, 1, 1),
    nthWeekdayOfMonth(year, 2, MONDAY, 1),
    nthWeekdayOfMonth(year, 3, MONDAY, 3),
    addDays(easter, -3), // jueves santo
    addDays(easter, -2), // viernes santo
    toIsoDate(year, 5, 1),
    toIsoDate(year, 9, 16),
    toIsoDate(year, 11, 2),
    nthWeekdayOfMonth(year, 11, MONDAY, 3),
    toIsoDate(year, 12, 12),
    toIsoDate(year, 12, 25),
  ].sort()
}

export function isBusinessDay(
  date: IsoDate,
  extraHolidays: IsoDate[] = [],
): boolean {
  const weekday = dayOfWeek(date)
  if (weekday === 0 || weekday === 6) return false

  const year = Number(date.slice(0, 4))
  return !bankHolidays(year).includes(date) && !extraHolidays.includes(date)
}

/** La misma fecha si es hábil; si no, el siguiente día hábil. */
export function nextBusinessDay(
  date: IsoDate,
  extraHolidays: IsoDate[] = [],
): IsoDate {
  let candidate = date
  while (!isBusinessDay(candidate, extraHolidays)) {
    candidate = addDays(candidate, 1)
  }
  return candidate
}

/** La misma fecha si es hábil; si no, el día hábil anterior. */
export function previousBusinessDay(
  date: IsoDate,
  extraHolidays: IsoDate[] = [],
): IsoDate {
  let candidate = date
  while (!isBusinessDay(candidate, extraHolidays)) {
    candidate = addDays(candidate, -1)
  }
  return candidate
}
