/** Formatos de fecha para la UI (es-MX). No lee el reloj: recibe fechas IsoDate. */
import { parseIsoDate, type IsoDate } from '../domain/dates'

// Se formatea en UTC porque la fecha se construye con Date.UTC: así nunca se
// recorre un día por la zona horaria del dispositivo.
const shortFormatter = new Intl.DateTimeFormat('es-MX', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})
const longFormatter = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})
const numericFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

function toUtcDate(date: IsoDate): Date {
  const { year, month, day } = parseIsoDate(date)
  return new Date(Date.UTC(year, month - 1, day))
}

/** "lun 26 de oct" */
export function formatShortDate(date: IsoDate): string {
  return shortFormatter.format(toUtcDate(date))
}

/** "lunes, 26 de octubre" */
export function formatLongDate(date: IsoDate): string {
  return longFormatter.format(toUtcDate(date))
}

/** "26 oct 2026" */
export function formatDateWithYear(date: IsoDate): string {
  return numericFormatter.format(toUtcDate(date))
}

/** 0 → "hoy", 1 → "mañana", 5 → "en 5 días", -2 → "hace 2 días" */
export function formatRelativeDays(days: number): string {
  if (days === 0) return 'hoy'
  if (days === 1) return 'mañana'
  if (days === -1) return 'ayer'
  return days > 0 ? `en ${days} días` : `hace ${-days} días`
}
