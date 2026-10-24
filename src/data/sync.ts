/**
 * Reglas de la sincronización entre dispositivos (funciones puras sobre AppData).
 *
 * - Gana el cambio más reciente (`updatedAt`); con empate se queda lo local.
 * - Un dispositivo sube lo que cambió desde su última subida (`lastPushedAt`).
 * - Las categorías por defecto que nadie ha tocado llevan fecha 1970 al sincronizar
 *   por primera vez: así nunca le ganan a una categoría renombrada en otro dispositivo.
 * - La tarjeta seleccionada y la fecha del último respaldo son de cada dispositivo.
 */
import { defaultCategories } from './defaults'
import type { AppData, Card, Category, Transaction } from './schema'

/** Fecha de las categorías por defecto sin modificar. */
export const UNTOUCHED_DEFAULT_TIMESTAMP = '1970-01-01T00:00:00.000Z'

export interface SyncChanges {
  cards: Card[]
  categories: Category[]
  transactions: Transaction[]
}

interface Synced {
  id: string
  updatedAt: string
}

/**
 * Registros con `updatedAt` igual o posterior a `since` (todos si es null).
 * Se incluye el mismo instante para no perder un cambio hecho en ese milisegundo;
 * reenviar algo que el servidor ya tiene no hace daño.
 */
export function changesSince(data: AppData, since: string | null): SyncChanges {
  const changed = <T extends Synced>(items: T[]) =>
    since === null ? items : items.filter((item) => item.updatedAt >= since)
  return {
    cards: changed(data.cards),
    categories: changed(data.categories),
    transactions: changed(data.transactions),
  }
}

export function countChanges(changes: SyncChanges): number {
  return (
    changes.cards.length +
    changes.categories.length +
    changes.transactions.length
  )
}

/** Mezcla `remote` en `local` por id: entra lo remoto solo si es más reciente. */
function mergeById<T extends Synced>(local: T[], remote: T[]): T[] {
  const merged = new Map(local.map((item) => [item.id, item]))
  for (const item of remote) {
    const current = merged.get(item.id)
    if (!current || item.updatedAt > current.updatedAt) {
      merged.set(item.id, item)
    }
  }
  return [...merged.values()]
}

/** Aplica lo que llegó del servidor sin pisar cambios locales más recientes. */
export function mergeRemoteChanges(
  data: AppData,
  remote: SyncChanges,
): AppData {
  const cards = mergeById(data.cards, remote.cards)
  const merged: AppData = {
    ...data,
    cards,
    categories: mergeById(data.categories, remote.categories),
    transactions: mergeById(data.transactions, remote.transactions),
  }

  // La tarjeta seleccionada pudo borrarse en otro dispositivo, o este no tenía
  // ninguna (p. ej. una computadora nueva): se elige la primera tarjeta activa.
  const activeCards = cards.filter((c) => c.deletedAt === null)
  const selectedIsActive = activeCards.some(
    (c) => c.id === data.settings.activeCardId,
  )
  if (!selectedIsActive) {
    merged.settings = {
      ...data.settings,
      activeCardId: activeCards[0]?.id ?? null,
    }
  }
  return merged
}

/** Pone fecha 1970 a las categorías por defecto que siguen tal como vienen. */
export function resetUntouchedDefaultCategories(data: AppData): AppData {
  const defaults = new Map(
    defaultCategories(UNTOUCHED_DEFAULT_TIMESTAMP).map((c) => [c.id, c]),
  )
  return {
    ...data,
    categories: data.categories.map((category) => {
      const original = defaults.get(category.id)
      const untouched =
        original !== undefined &&
        category.deletedAt === null &&
        category.name === original.name &&
        category.icon === original.icon
      return untouched ? original : category
    }),
  }
}
