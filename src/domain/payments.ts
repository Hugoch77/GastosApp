/**
 * Reglas para el atajo "Ya pagué".
 *
 * Un pago cuenta contra el estado facturado si su fecha cae dentro del Periodo Actual
 * (desde el inicio del periodo; ver `getDashboardSummary`). Un pago anterior pertenece
 * al estado pasado, y uno con fecha futura todavía no ha ocurrido.
 */
import { isValidIsoDate, type IsoDate } from './dates'

export type PaymentDateCheck = 'ok' | 'invalid' | 'future' | 'before-cut'

export function checkPaymentDate(
  date: string,
  today: IsoDate,
  currentPeriodStart: IsoDate,
): PaymentDateCheck {
  if (!isValidIsoDate(date)) return 'invalid'
  if (date > today) return 'future'
  if (date < currentPeriodStart) return 'before-cut'
  return 'ok'
}
