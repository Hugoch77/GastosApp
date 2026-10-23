/**
 * Compras a meses sin intereses (MSI).
 *
 * - La mensualidad es floor(total / meses); el residuo se reparte de 1 en 1 centavo
 *   en las primeras cuotas, así la suma siempre es exactamente el total.
 * - La primera cuota cae en el estado de cuenta de la compra; cada cuota siguiente,
 *   en el estado siguiente.
 */
import { nextCutOnOrAfter } from './billing'
import { addDays, type IsoDate } from './dates'
import { assertCents } from './money'

export interface InstallmentPayment {
  /** 1 = primera mensualidad */
  number: number
  /** Fecha de corte del estado de cuenta donde se cobra */
  cutDate: IsoDate
  amountCents: number
}

export function splitInstallments(
  totalCents: number,
  months: number,
): number[] {
  assertCents(totalCents)
  if (totalCents < 0) {
    throw new Error(
      `El total de una compra a meses no puede ser negativo: ${totalCents}`,
    )
  }
  if (!Number.isInteger(months) || months < 1) {
    throw new Error(`Número de meses inválido: ${months}`)
  }

  const base = Math.floor(totalCents / months)
  const remainder = totalCents % months
  return Array.from({ length: months }, (_, i) =>
    i < remainder ? base + 1 : base,
  )
}

export function installmentSchedule(
  purchaseDate: IsoDate,
  totalCents: number,
  months: number,
  cutDay: number,
): InstallmentPayment[] {
  let cutDate = nextCutOnOrAfter(purchaseDate, cutDay)
  return splitInstallments(totalCents, months).map((amountCents, i) => {
    const payment = { number: i + 1, cutDate, amountCents }
    cutDate = nextCutOnOrAfter(addDays(cutDate, 1), cutDay)
    return payment
  })
}
