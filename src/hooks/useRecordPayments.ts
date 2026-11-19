import { useCallback } from 'react'
import type { IsoDate } from '../domain/dates'
import { useGastos } from '../state/gastosContext'

export const PAYMENT_DESCRIPTION = 'Pago a tarjeta'

export interface PaymentToRecord {
  cardId: string
  amountCents: number
}

/**
 * Registra pagos (movimientos tipo `payment`) con la misma fecha, uno por tarjeta.
 * Es lo mismo que capturarlos a mano en "Nuevo movimiento": en cuanto se guardan,
 * el panel descuenta lo pagado del estado facturado.
 */
export function useRecordPayments() {
  const { mutate } = useGastos()

  return useCallback(
    (payments: PaymentToRecord[], date: IsoDate) =>
      mutate(async (repo) => {
        for (const payment of payments) {
          await repo.createTransaction({
            cardId: payment.cardId,
            type: 'payment',
            date,
            amountCents: payment.amountCents,
            description: PAYMENT_DESCRIPTION,
            categoryId: null,
            installments: null,
          })
        }
      }),
    [mutate],
  )
}
