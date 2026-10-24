import { CURRENT_SCHEMA_VERSION, type AppData, type Category } from './schema'

/** Categoría de respaldo: no se puede borrar y recibe los movimientos de las borradas. */
export const OTHER_CATEGORY_ID = 'other'

const DEFAULT_CATEGORIES: [id: string, name: string, icon: string][] = [
  ['food', 'Comida', '🍔'],
  ['groceries', 'Supermercado', '🛒'],
  ['transport', 'Transporte', '🚗'],
  ['fuel', 'Gasolina', '⛽'],
  ['utilities', 'Servicios', '💡'],
  ['health', 'Salud', '💊'],
  ['entertainment', 'Entretenimiento', '🎬'],
  ['clothing', 'Ropa', '👕'],
  ['home', 'Hogar', '🏠'],
  ['education', 'Educación', '📚'],
  ['travel', 'Viajes', '✈️'],
  ['subscriptions', 'Suscripciones', '📺'],
  [OTHER_CATEGORY_ID, 'Otros', '📦'],
]

export function defaultCategories(now: string): Category[] {
  return DEFAULT_CATEGORIES.map(([id, name, icon]) => ({
    id,
    name,
    icon,
    updatedAt: now,
    deletedAt: null,
  }))
}

/** Datos iniciales cuando no hay nada guardado. */
export function emptyAppData(now: string): AppData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: { activeCardId: null, extraHolidays: [], lastBackupAt: null },
    cards: [],
    categories: defaultCategories(now),
    transactions: [],
  }
}
