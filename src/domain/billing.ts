/**
 * Cortes, periodos y fechas de pago de una tarjeta de crédito.
 *
 * Decisiones de negocio:
 * - Un día de corte/pago mayor a los días del mes se recorta al último día del mes.
 * - Lo hecho el mismo día de corte depende del banco (`cutDayInNextPeriod`):
 *   - false: el periodo va del día siguiente al corte anterior hasta el día de corte,
 *     INCLUSIVE. El día del corte, ese ciclo sigue siendo el "actual".
 *   - true: el banco corta al iniciar el día; el periodo va del corte anterior hasta
 *     el día ANTERIOR al corte, y lo del día de corte entra al estado siguiente.
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

/** Lo necesario para saber a qué estado de cuenta pertenece una fecha. */
export interface CutSchedule {
  /** Día de corte, 1–31 */
  cutDay: number
  /** true: los movimientos del día de corte entran al estado siguiente */
  cutDayInNextPeriod: boolean
}

export interface BillingConfig extends CutSchedule {
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

/** Lo mínimo para identificar un estado: su corte y las fechas de su periodo. */
export type StatementDates = Pick<Statement, 'cutDate' | 'period'>

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

/** Fecha de corte del mes desplazado `months` meses respecto al mes de `date` (p. ej. el corte anterior). */
export function cutDateRelativeTo(
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

/** Fecha de corte del estado de cuenta al que pertenece un movimiento con fecha `date`. */
export function statementCutFor(date: IsoDate, schedule: CutSchedule): IsoDate {
  return schedule.cutDayInNextPeriod
    ? nextCutOnOrAfter(addDays(date, 1), schedule.cutDay)
    : nextCutOnOrAfter(date, schedule.cutDay)
}

/** Fechas (inclusive) del periodo que cierra en `cutDate`. */
export function periodEndingAt(
  cutDate: IsoDate,
  schedule: CutSchedule,
): Period {
  const previousCut = cutDateRelativeTo(cutDate, schedule.cutDay, -1)
  return schedule.cutDayInNextPeriod
    ? { start: previousCut, end: addDays(cutDate, -1) }
    : { start: addDays(previousCut, 1), end: cutDate }
}

/** Periodo (estado de cuenta) al que pertenece un movimiento con fecha `date`. */
export function periodContaining(date: IsoDate, schedule: CutSchedule): Period {
  return periodEndingAt(statementCutFor(date, schedule), schedule)
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
    period: periodEndingAt(cutDate, config),
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
  // El ciclo actual es el estado al que entraría un movimiento hecho hoy;
  // el facturado, el que cerró justo antes.
  const currentCut = statementCutFor(today, config)
  const billedCut = cutDateRelativeTo(currentCut, config.cutDay, -1)
  return {
    billed: statementForCut(billedCut, config),
    current: statementForCut(currentCut, config),
    isCutDay: currentCut === today,
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
