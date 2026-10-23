/** Utilidades para pruebas de la capa de datos (no se usan en la app). */
import { emptyAppData } from './defaults'
import type { AppData, Card, Transaction } from './schema'

/** Implementación de Storage en memoria, equivalente a LocalStorage. */
export function createMemoryStorage(
  initial: Record<string, string> = {},
): Storage {
  const items = new Map(Object.entries(initial))
  return {
    get length() {
      return items.size
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key)
    },
    setItem: (key, value) => {
      items.set(key, String(value))
    },
  }
}

/** Reloj que avanza un minuto en cada llamada, para distinguir createdAt de updatedAt. */
export function sequentialClock(
  start = '2026-10-23T18:00:00.000Z',
): () => string {
  let ms = Date.parse(start)
  return () => {
    const value = new Date(ms).toISOString()
    ms += 60_000
    return value
  }
}

export function sequentialIds(prefix = 'id'): () => string {
  let n = 0
  return () => `${prefix}-${++n}`
}

const T0 = '2026-10-01T12:00:00.000Z'

export function sampleCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    name: 'Tarjeta principal',
    cutDay: 15,
    cutDayInNextPeriod: false,
    dueDay: 5,
    paymentBufferDays: 2,
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    ...overrides,
  }
}

export function sampleTransaction(
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    id: 'tx-1',
    cardId: 'card-1',
    date: '2026-10-10',
    description: 'Supermercado',
    amountCents: 123456,
    type: 'charge',
    categoryId: 'groceries',
    installments: null,
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    ...overrides,
  }
}

/** AppData válido con una tarjeta activa y un movimiento. */
export function sampleAppData(overrides: Partial<AppData> = {}): AppData {
  return {
    ...emptyAppData(T0),
    settings: { activeCardId: 'card-1', extraHolidays: [] },
    cards: [sampleCard()],
    transactions: [sampleTransaction()],
    ...overrides,
  }
}
