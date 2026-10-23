/**
 * Helpers para fechas de calendario SIN hora.
 *
 * Todas las fechas del dominio son strings "YYYY-MM-DD" (IsoDate). Así evitamos
 * los desfases de zona horaria que aparecen al usar objetos Date con hora.
 * Como el formato es de ancho fijo, dos IsoDate se pueden comparar con < y >.
 *
 * Este módulo nunca lee el reloj del sistema: "hoy" llega siempre como parámetro.
 */

/** Fecha de calendario en formato "YYYY-MM-DD". */
export type IsoDate = string

export interface DateParts {
  year: number
  /** 1 = enero ... 12 = diciembre */
  month: number
  day: number
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 24 * 60 * 60 * 1000

export function toIsoDate(year: number, month: number, day: number): IsoDate {
  const yyyy = String(year).padStart(4, '0')
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function parseIsoDate(date: IsoDate): DateParts {
  const match = ISO_DATE_PATTERN.exec(date)
  if (!match) {
    throw new Error(`Fecha inválida, se esperaba "YYYY-MM-DD": "${date}"`)
  }
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > daysInMonth(parts.year, parts.month)
  ) {
    throw new Error(`Fecha inexistente: "${date}"`)
  }
  return parts
}

export function isValidIsoDate(date: string): boolean {
  try {
    parseIsoDate(date)
    return true
  } catch {
    return false
  }
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInMonth(year: number, month: number): number {
  const days = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]
  return days[month - 1]
}

/**
 * Crea una fecha recortando el día al último día del mes si no existe.
 * Ej.: día 31 en febrero → 28 (o 29 en año bisiesto); día 31 en abril → 30.
 */
export function clampedDate(year: number, month: number, day: number): IsoDate {
  return toIsoDate(year, month, Math.min(day, daysInMonth(year, month)))
}

/** Desplaza un mes (año + mes) n meses hacia adelante (o atrás si n < 0). */
export function shiftMonth(
  year: number,
  month: number,
  months: number,
): { year: number; month: number } {
  const zeroBasedIndex = year * 12 + (month - 1) + months
  return {
    year: Math.floor(zeroBasedIndex / 12),
    month: (zeroBasedIndex % 12) + 1,
  }
}

// Date.UTC solo se usa como calculadora de días; nunca para leer el reloj.
function toUtcMs(date: IsoDate): number {
  const { year, month, day } = parseIsoDate(date)
  return Date.UTC(year, month - 1, day)
}

function fromUtcMs(ms: number): IsoDate {
  const d = new Date(ms)
  return toIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtcMs(toUtcMs(date) + days * MS_PER_DAY)
}

/** Días de `from` a `to` (negativo si `to` es anterior). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY)
}

/** 0 = domingo, 1 = lunes ... 6 = sábado */
export function dayOfWeek(date: IsoDate): number {
  return new Date(toUtcMs(date)).getUTCDay()
}
