/** Consultas de solo lectura sobre AppData; ocultan los registros borrados. */
import type { BillingConfig } from '../domain/billing'
import type { AppData, Card, Category, Settings, Transaction } from './schema'

export function activeCards(data: AppData): Card[] {
  return data.cards.filter((c) => c.deletedAt === null)
}

export function activeCategories(data: AppData): Category[] {
  return data.categories.filter((c) => c.deletedAt === null)
}

export function selectedCard(data: AppData): Card | null {
  return (
    activeCards(data).find((c) => c.id === data.settings.activeCardId) ?? null
  )
}

/** Movimientos vigentes de una tarjeta, del más reciente al más antiguo. */
export function transactionsForCard(
  data: AppData,
  cardId: string,
): Transaction[] {
  return data.transactions
    .filter((t) => t.cardId === cardId && t.deletedAt === null)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    )
}

export function billingConfigFor(
  card: Card,
  settings: Settings,
): BillingConfig {
  return {
    cutDay: card.cutDay,
    cutDayInNextPeriod: card.cutDayInNextPeriod,
    dueDay: card.dueDay,
    paymentBufferDays: card.paymentBufferDays,
    extraHolidays: settings.extraHolidays,
  }
}
