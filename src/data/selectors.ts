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

/** Movimientos vigentes por categoría (todas las tarjetas). */
export function transactionCountByCategory(data: AppData): Map<string, number> {
  const counts = new Map<string, number>()
  for (const t of data.transactions) {
    if (t.deletedAt !== null || t.categoryId === null) continue
    counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1)
  }
  return counts
}

/**
 * Instante del cambio más antiguo que aún no está en un respaldo
 * (tarjetas, categorías o movimientos); null si todo está respaldado.
 */
export function firstUnsavedChangeAt(data: AppData): string | null {
  const { lastBackupAt } = data.settings
  const unsaved = [...data.cards, ...data.categories, ...data.transactions]
    .map((item) => item.updatedAt)
    .filter((updatedAt) => lastBackupAt === null || updatedAt > lastBackupAt)
    .sort()
  return unsaved[0] ?? null
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
