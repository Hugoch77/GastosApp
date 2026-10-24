/** Formatos de fecha para la UI (es-MX). No lee el reloj: recibe fechas IsoDate. */
import { parseIsoDate, type IsoDate } from '../domain/dates'
import { APP_TIME_ZONE, todayInMexico } from './today'

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

const monthFormatter = new Intl.DateTimeFormat('es-MX', {
  month: 'short',
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

/** "nov" */
export function formatMonth(date: IsoDate): string {
  return monthFormatter.format(toUtcDate(date)).replace('.', '')
}

/** "nov 2026" (el año se arma aparte para no depender del "de" de cada navegador) */
export function formatMonthYear(date: IsoDate): string {
  return `${formatMonth(date)} ${parseIsoDate(date).year}`
}

/** 0 → "hoy", 1 → "mañana", 5 → "en 5 días", -2 → "hace 2 días" */
export function formatRelativeDays(days: number): string {
  if (days === 0) return 'hoy'
  if (days === 1) return 'mañana'
  if (days === -1) return 'ayer'
  return days > 0 ? `en ${days} días` : `hace ${-days} días`
}

// Los instantes (createdAt, lastSyncAt...) se guardan en UTC; se muestran en hora de la CDMX.
const timeFormatter = new Intl.DateTimeFormat('es-MX', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: APP_TIME_ZONE,
})

/** Instante ISO → "hoy, 3:42 p.m." o "23 oct 2026, 3:42 p.m." (hora de la CDMX) */
export function formatTimestamp(timestamp: string, today: IsoDate): string {
  const instant = new Date(timestamp)
  const date = todayInMexico(instant)
  // Intl separa "p. m." con espacios especiales; se normalizan a espacios comunes.
  const time = timeFormatter.format(instant).replace(/\s/g, ' ')
  return `${date === today ? 'hoy' : formatDateWithYear(date)}, ${time}`
}
