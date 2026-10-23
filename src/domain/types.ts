/**
 * Tipos mínimos que la lógica de dominio necesita de un movimiento.
 * La capa de datos tendrá un tipo más completo (descripción, categoría, tarjeta...)
 * que es compatible con este gracias al tipado estructural de TypeScript.
 */
import type { IsoDate } from './dates'

export type TransactionType = 'charge' | 'payment' | 'refund'

/** Compra a meses sin intereses. */
export interface Installments {
  months: number
}

export interface Transaction {
  id: string
  date: IsoDate
  /** Siempre positivo, en centavos; el signo lo da `type`. */
  amountCents: number
  type: TransactionType
  /** Solo aplica a cargos; `null` = de contado. */
  installments: Installments | null
}
