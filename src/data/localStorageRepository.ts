/**
 * Implementación de GastosRepository sobre LocalStorage.
 *
 * Todo se guarda bajo una sola clave como un objeto AppData. Antes de escribir se
 * valida el objeto completo, así nunca se guarda algo que no se pueda volver a leer.
 */
import { nowTimestamp } from '../lib/today'
import { parseBackup, serializeBackup } from './backup'
import { emptyAppData } from './defaults'
import { migrateToCurrent } from './migrations'
import { NotFoundError, type GastosRepository } from './repository'
import {
  AppDataSchema,
  CardInputSchema,
  TransactionInputSchema,
  type AppData,
  type Card,
  type CardInput,
  type Settings,
  type Transaction,
  type TransactionInput,
} from './schema'

export const STORAGE_KEY = 'gastosapp'

/** Los datos guardados existen pero no se pueden leer; no se sobrescriben. */
export class StorageCorruptedError extends Error {}

export interface RepositoryDeps {
  storage: Storage
  now: () => string
  newId: () => string
}

export class LocalStorageRepository implements GastosRepository {
  private readonly deps: RepositoryDeps

  /** En la app se usa sin argumentos; las pruebas inyectan storage, reloj e ids. */
  constructor(deps: Partial<RepositoryDeps> = {}) {
    this.deps = {
      storage: deps.storage ?? window.localStorage,
      now: deps.now ?? nowTimestamp,
      newId: deps.newId ?? (() => crypto.randomUUID()),
    }
  }

  // ---------- lectura / escritura ----------

  private read(): AppData {
    const raw = this.deps.storage.getItem(STORAGE_KEY)
    if (raw === null) return emptyAppData(this.deps.now())

    try {
      return migrateToCurrent(JSON.parse(raw))
    } catch (error) {
      throw new StorageCorruptedError(
        'Los datos guardados no se pueden leer. Importa un respaldo para recuperarlos.',
        { cause: error },
      )
    }
  }

  private write(data: AppData): void {
    const valid = AppDataSchema.parse(data)
    this.deps.storage.setItem(STORAGE_KEY, JSON.stringify(valid))
  }

  /** Lee, aplica un cambio y guarda; regresa lo que regrese `change`. */
  private mutate<T>(change: (data: AppData, now: string) => T): T {
    const data = this.read()
    const result = change(data, this.deps.now())
    this.write(data)
    return result
  }

  // ---------- consultas ----------

  async getData(): Promise<AppData> {
    return this.read()
  }

  // ---------- tarjetas ----------

  async createCard(input: CardInput): Promise<Card> {
    const fields = CardInputSchema.parse(input)
    return this.mutate((data, now) => {
      const card: Card = {
        ...fields,
        id: this.deps.newId(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      data.cards.push(card)
      data.settings.activeCardId ??= card.id
      return card
    })
  }

  async updateCard(id: string, input: CardInput): Promise<Card> {
    const fields = CardInputSchema.parse(input)
    return this.mutate((data, now) => {
      const index = findActiveIndex(data.cards, id, 'Tarjeta')
      data.cards[index] = { ...data.cards[index], ...fields, updatedAt: now }
      return data.cards[index]
    })
  }

  async deleteCard(id: string): Promise<void> {
    this.mutate((data, now) => {
      const index = findActiveIndex(data.cards, id, 'Tarjeta')
      data.cards[index] = {
        ...data.cards[index],
        deletedAt: now,
        updatedAt: now,
      }

      data.transactions = data.transactions.map((t) =>
        t.cardId === id && t.deletedAt === null
          ? { ...t, deletedAt: now, updatedAt: now }
          : t,
      )

      if (data.settings.activeCardId === id) {
        const nextCard = data.cards.find((c) => c.deletedAt === null)
        data.settings.activeCardId = nextCard?.id ?? null
      }
    })
  }

  // ---------- movimientos ----------

  async createTransaction(input: TransactionInput): Promise<Transaction> {
    const fields = TransactionInputSchema.parse(input)
    return this.mutate((data, now) => {
      findActiveIndex(data.cards, fields.cardId, 'Tarjeta')
      const transaction: Transaction = {
        ...fields,
        id: this.deps.newId(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      data.transactions.push(transaction)
      return transaction
    })
  }

  async updateTransaction(
    id: string,
    input: TransactionInput,
  ): Promise<Transaction> {
    const fields = TransactionInputSchema.parse(input)
    return this.mutate((data, now) => {
      findActiveIndex(data.cards, fields.cardId, 'Tarjeta')
      const index = findActiveIndex(data.transactions, id, 'Movimiento')
      data.transactions[index] = {
        ...data.transactions[index],
        ...fields,
        updatedAt: now,
      }
      return data.transactions[index]
    })
  }

  async deleteTransaction(id: string): Promise<void> {
    this.mutate((data, now) => {
      const index = findActiveIndex(data.transactions, id, 'Movimiento')
      data.transactions[index] = {
        ...data.transactions[index],
        deletedAt: now,
        updatedAt: now,
      }
    })
  }

  // ---------- configuración ----------

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    return this.mutate((data) => {
      data.settings = { ...data.settings, ...patch }
      return data.settings
    })
  }

  // ---------- respaldo ----------

  async exportBackup(): Promise<string> {
    return serializeBackup(this.read(), this.deps.now())
  }

  async importBackup(json: string) {
    const result = parseBackup(json)
    if (result.ok) this.write(result.data)
    return result
  }

  async clearAll(): Promise<void> {
    this.deps.storage.removeItem(STORAGE_KEY)
  }
}

function findActiveIndex(
  items: { id: string; deletedAt: string | null }[],
  id: string,
  label: string,
): number {
  const index = items.findIndex(
    (item) => item.id === id && item.deletedAt === null,
  )
  if (index === -1) throw new NotFoundError(`${label} inexistente: ${id}`)
  return index
}
