/**
 * Cortes, periodos y fechas de pago de una tarjeta de crédito.
 *
 * Decisiones de negocio:
 * - Un día de corte/pago mayor a los días del mes se recorta al último día del mes.
 * - Un periodo va del día siguiente al corte anterior hasta el día de corte, INCLUSIVE:
 *   un movimiento hecho el día de corte pertenece al estado que cierra ese día.
 * - El día del corte, ese ciclo sigue siendo el "actual"; se factura al día siguiente.
 * - La fecha límite es la primera fecha con `dueDay` estrictamente posterior al corte.
 * - Si la fecha límite cae en día inhábil, la nominal se mantiene como principal y
 *   la "efectiva" (siguiente día hábil) es informativa.
 * - La fecha sugerida de pago es la límite menos `paymentBufferDays`, movida al día
 *   hábil anterior si cae en inhábil.
 */
import {
  addDays,
  clampedDate,
  daysBetween,
  parseIsoDate,
  shiftMonth,
  type IsoDate,
} from './dates'
import { nextBusinessDay, previousBusinessDay } from './holidays'

export interface BillingConfig {
  /** Día de corte, 1–31 */
  cutDay: number
  /** Día límite de pago, 1–31 */
  dueDay: number
  /** Días antes de la fecha límite en los que el usuario quiere pagar */
  paymentBufferDays: number
  /** Días inhábiles adicionales a los calculados por regla */
  extraHolidays?: IsoDate[]
}

/** Rango de fechas con ambos extremos incluidos. */
export interface Period {
  start: IsoDate
  end: IsoDate
}

/** Un estado de cuenta: el periodo que cierra en `cutDate` y sus fechas de pago. */
export interface Statement {
  period: Period
  cutDate: IsoDate
  /** Fecha límite tal como aparece en el estado de cuenta */
  dueDate: IsoDate
  /** Siguiente día hábil si `dueDate` es inhábil (informativo) */
  effectiveDueDate: IsoDate
  /** Fecha en la que el usuario planea pagar */
  suggestedPaymentDate: IsoDate
}

export interface BillingCycle {
  /** Estado ya cortado cuyo pago está pendiente o ya vencido */
  billed: Statement
  /** Ciclo abierto; cierra en `current.cutDate` */
  current: Statement
  /** true si hoy es el día de corte del ciclo actual */
  isCutDay: boolean
}

export type PaymentUrgency =
  'on-track' | 'due-soon' | 'past-suggested' | 'overdue'

/** Con cuántos días de anticipación a la fecha sugerida se considera "pronto". */
export const DUE_SOON_DAYS = 5

export function cutDateInMonth(
  year: number,
  month: number,
  cutDay: number,
): IsoDate {
  return clampedDate(year, month, cutDay)
}

/** Fecha de corte del mes desplazado `months` meses respecto al mes de `date`. */
function cutDateRelativeTo(
  date: IsoDate,
  cutDay: number,
  months: number,
): IsoDate {
  const { year, month } = parseIsoDate(date)
  const target = shiftMonth(year, month, months)
  return cutDateInMonth(target.year, target.month, cutDay)
}

/** El corte más reciente ESTRICTAMENTE anterior a `date`. */
export function lastCutBefore(date: IsoDate, cutDay: number): IsoDate {
  const cutThisMonth = cutDateRelativeTo(date, cutDay, 0)
  return cutThisMonth < date
    ? cutThisMonth
    : cutDateRelativeTo(date, cutDay, -1)
}

/** El siguiente corte, que puede ser `date` misma. */
export function nextCutOnOrAfter(date: IsoDate, cutDay: number): IsoDate {
  const cutThisMonth = cutDateRelativeTo(date, cutDay, 0)
  return cutThisMonth >= date
    ? cutThisMonth
    : cutDateRelativeTo(date, cutDay, 1)
}

/** Periodo que cierra en `cutDate`: del día siguiente al corte anterior hasta `cutDate`. */
export function periodEndingAt(cutDate: IsoDate, cutDay: number): Period {
  const previousCut = cutDateRelativeTo(cutDate, cutDay, -1)
  return { start: addDays(previousCut, 1), end: cutDate }
}

/** Periodo (estado de cuenta) al que pertenece un movimiento con fecha `date`. */
export function periodContaining(date: IsoDate, cutDay: number): Period {
  return periodEndingAt(nextCutOnOrAfter(date, cutDay), cutDay)
}

/** Primera fecha con `dueDay` (recortado al mes) estrictamente posterior al corte. */
export function dueDateForCut(cutDate: IsoDate, dueDay: number): IsoDate {
  const { year, month } = parseIsoDate(cutDate)
  const sameMonth = clampedDate(year, month, dueDay)
  if (sameMonth > cutDate) return sameMonth

  const next = shiftMonth(year, month, 1)
  return clampedDate(next.year, next.month, dueDay)
}

export function suggestedPaymentDate(
  dueDate: IsoDate,
  paymentBufferDays: number,
  extraHolidays: IsoDate[] = [],
): IsoDate {
  return previousBusinessDay(
    addDays(dueDate, -paymentBufferDays),
    extraHolidays,
  )
}

export function statementForCut(
  cutDate: IsoDate,
  config: BillingConfig,
): Statement {
  const dueDate = dueDateForCut(cutDate, config.dueDay)
  return {
    period: periodEndingAt(cutDate, config.cutDay),
    cutDate,
    dueDate,
    effectiveDueDate: nextBusinessDay(dueDate, config.extraHolidays),
    suggestedPaymentDate: suggestedPaymentDate(
      dueDate,
      config.paymentBufferDays,
      config.extraHolidays,
    ),
  }
}

/** Estado facturado y ciclo actual a partir de la fecha de hoy. */
export function getBillingCycle(
  today: IsoDate,
  config: BillingConfig,
): BillingCycle {
  const lastCut = lastCutBefore(today, config.cutDay)
  const nextCut = nextCutOnOrAfter(today, config.cutDay)
  return {
    billed: statementForCut(lastCut, config),
    current: statementForCut(nextCut, config),
    isCutDay: nextCut === today,
  }
}

/** Semáforo de pago respecto a la fecha sugerida y la fecha límite nominal. */
export function paymentUrgency(
  today: IsoDate,
  statement: Statement,
): PaymentUrgency {
  if (today > statement.dueDate) return 'overdue'
  if (today > statement.suggestedPaymentDate) return 'past-suggested'
  if (daysBetween(today, statement.suggestedPaymentDate) <= DUE_SOON_DAYS)
    return 'due-soon'
  return 'on-track'
}
