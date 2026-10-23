/**
 * ÚNICO lugar de la app que lee el reloj del sistema.
 * El resto del código recibe "hoy" como parámetro.
 */
import type { IsoDate } from '../domain/dates'

export const APP_TIME_ZONE = 'America/Mexico_City'

// 'en-CA' formatea como "YYYY-MM-DD".
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Fecha de hoy en la Ciudad de México. `now` se puede inyectar en pruebas. */
export function todayInMexico(now: Date = new Date()): IsoDate {
  return formatter.format(now)
}
