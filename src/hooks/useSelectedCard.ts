import { activeCards, billingConfigFor, selectedCard } from '../data/selectors'
import { useGastos } from '../state/gastosContext'

/** Tarjeta seleccionada y su configuración de facturación. */
export function useSelectedCard() {
  const { data } = useGastos()
  const card = selectedCard(data) ?? activeCards(data)[0]
  if (!card) {
    throw new Error('No hay tarjetas registradas')
  }
  return { card, config: billingConfigFor(card, data.settings) }
}
