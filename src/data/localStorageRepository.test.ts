import { beforeEach, describe, expect, it } from 'vitest'
import { serializeBackup } from './backup'
import {
  LocalStorageRepository,
  STORAGE_KEY,
  StorageCorruptedError,
} from './localStorageRepository'
import { NotFoundError } from './repository'
import type { CardInput, TransactionInput } from './schema'
import { activeCards, selectedCard, transactionsForCard } from './selectors'
import {
  createMemoryStorage,
  sampleAppData,
  sequentialClock,
  sequentialIds,
} from './testing'

const cardInput: CardInput = {
  name: 'Azul',
  cutDay: 15,
  dueDay: 5,
  paymentBufferDays: 2,
}

function txInput(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    cardId: 'card-1',
    date: '2026-10-10',
    description: 'Gasolina',
    amountCents: 80000,
    type: 'charge',
    categoryId: 'fuel',
    installments: null,
    ...overrides,
  }
}

let storage: Storage
let repo: LocalStorageRepository

function newRepo() {
  return new LocalStorageRepository({
    storage,
    now: sequentialClock(),
    newId: sequentialIds('card'),
  })
}

beforeEach(() => {
  storage = createMemoryStorage()
  repo = newRepo()
})

describe('sin datos guardados', () => {
  it('regresa datos vacíos con categorías por defecto y no escribe nada', async () => {
    const data = await repo.getData()
    expect(data.cards).toEqual([])
    expect(data.transactions).toEqual([])
    expect(data.categories.map((c) => c.name)).toContain('Supermercado')
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('tarjetas', () => {
  it('crear: asigna id y fechas, la marca como activa y persiste', async () => {
    const card = await repo.createCard(cardInput)

    expect(card).toMatchObject({ id: 'card-1', name: 'Azul', deletedAt: null })
    expect(card.createdAt).toBe(card.updatedAt)

    // Otra instancia (como recargar la página) lee lo mismo.
    const data = await newRepo().getData()
    expect(selectedCard(data)?.id).toBe('card-1')
  })

  it('la segunda tarjeta no cambia la tarjeta activa', async () => {
    await repo.createCard(cardInput)
    await repo.createCard({ ...cardInput, name: 'Oro' })
    expect((await repo.getData()).settings.activeCardId).toBe('card-1')
  })

  it('editar: conserva createdAt y actualiza updatedAt', async () => {
    const card = await repo.createCard(cardInput)
    const updated = await repo.updateCard(card.id, { ...cardInput, cutDay: 31 })

    expect(updated.cutDay).toBe(31)
    expect(updated.createdAt).toBe(card.createdAt)
    expect(updated.updatedAt > card.updatedAt).toBe(true)
  })

  it('valida la captura', async () => {
    await expect(
      repo.createCard({ ...cardInput, cutDay: 32 }),
    ).rejects.toThrow()
    await expect(repo.createCard({ ...cardInput, name: ' ' })).rejects.toThrow()
  })

  it('borrar: borrado lógico en cascada y cambia la tarjeta activa', async () => {
    const first = await repo.createCard(cardInput)
    const second = await repo.createCard({ ...cardInput, name: 'Oro' })
    await repo.createTransaction(txInput({ cardId: first.id }))

    await repo.deleteCard(first.id)
    const data = await repo.getData()

    expect(activeCards(data).map((c) => c.id)).toEqual([second.id])
    expect(data.settings.activeCardId).toBe(second.id)
    expect(transactionsForCard(data, first.id)).toEqual([])
    // Siguen guardados (para sincronizar en el futuro), solo marcados como borrados.
    expect(data.transactions[0].deletedAt).not.toBeNull()
  })

  it('borrar la única tarjeta deja sin tarjeta activa', async () => {
    const card = await repo.createCard(cardInput)
    await repo.deleteCard(card.id)
    expect((await repo.getData()).settings.activeCardId).toBeNull()
  })

  it('editar o borrar una tarjeta inexistente o borrada falla', async () => {
    await expect(repo.updateCard('nope', cardInput)).rejects.toThrow(
      NotFoundError,
    )
    const card = await repo.createCard(cardInput)
    await repo.deleteCard(card.id)
    await expect(repo.deleteCard(card.id)).rejects.toThrow(NotFoundError)
  })
})

describe('movimientos', () => {
  beforeEach(async () => {
    await repo.createCard(cardInput) // id: card-1
  })

  it('crear y listar del más reciente al más antiguo', async () => {
    await repo.createTransaction(
      txInput({ date: '2026-10-01', description: 'A' }),
    )
    await repo.createTransaction(
      txInput({ date: '2026-10-20', description: 'B' }),
    )
    await repo.createTransaction(
      txInput({ date: '2026-10-20', description: 'C' }),
    )

    const list = transactionsForCard(await repo.getData(), 'card-1')
    expect(list.map((t) => t.description)).toEqual(['C', 'B', 'A'])
  })

  it('crear a meses sin intereses', async () => {
    const tx = await repo.createTransaction(
      txInput({ installments: { months: 12 } }),
    )
    expect(tx.installments).toEqual({ months: 12 })
  })

  it('rechaza un movimiento de una tarjeta inexistente', async () => {
    await expect(
      repo.createTransaction(txInput({ cardId: 'nope' })),
    ).rejects.toThrow(NotFoundError)
  })

  it('rechaza una categoría inexistente sin guardar nada', async () => {
    await expect(
      repo.createTransaction(txInput({ categoryId: 'nope' })),
    ).rejects.toThrow()
    expect((await repo.getData()).transactions).toEqual([])
  })

  it('rechaza MSI en un pago', async () => {
    await expect(
      repo.createTransaction(
        txInput({ type: 'payment', installments: { months: 3 } }),
      ),
    ).rejects.toThrow()
  })

  it('editar conserva createdAt', async () => {
    const tx = await repo.createTransaction(txInput())
    const updated = await repo.updateTransaction(
      tx.id,
      txInput({ amountCents: 1 }),
    )
    expect(updated).toMatchObject({ amountCents: 1, createdAt: tx.createdAt })
    expect(updated.updatedAt > tx.updatedAt).toBe(true)
  })

  it('borrar lo oculta de los listados', async () => {
    const tx = await repo.createTransaction(txInput())
    await repo.deleteTransaction(tx.id)
    expect(transactionsForCard(await repo.getData(), 'card-1')).toEqual([])
    await expect(repo.deleteTransaction(tx.id)).rejects.toThrow(NotFoundError)
  })
})

describe('configuración', () => {
  it('actualiza solo los campos indicados', async () => {
    const settings = await repo.updateSettings({
      extraHolidays: ['2030-10-01'],
    })
    expect(settings).toEqual({
      activeCardId: null,
      extraHolidays: ['2030-10-01'],
    })
  })

  it('rechaza una tarjeta activa inexistente', async () => {
    await expect(
      repo.updateSettings({ activeCardId: 'nope' }),
    ).rejects.toThrow()
  })
})

describe('respaldo', () => {
  it('exportar e importar en otro dispositivo deja los mismos datos', async () => {
    await repo.createCard(cardInput)
    await repo.createTransaction(txInput())
    const json = await repo.exportBackup()

    storage = createMemoryStorage()
    const other = newRepo()
    expect(await other.importBackup(json)).toMatchObject({ ok: true })
    expect(await other.getData()).toEqual(await repo.getData())
  })

  it('importar reemplaza los datos actuales', async () => {
    await repo.createCard(cardInput)
    const backup = serializeBackup(sampleAppData(), '2026-10-23T00:00:00.000Z')

    await repo.importBackup(backup)
    const data = await repo.getData()
    expect(data.cards.map((c) => c.name)).toEqual(['Tarjeta principal'])
  })

  it('un respaldo inválido no modifica nada', async () => {
    await repo.createCard(cardInput)
    const before = storage.getItem(STORAGE_KEY)

    const result = await repo.importBackup('{"schemaVersion": 1}')
    expect(result.ok).toBe(false)
    expect(storage.getItem(STORAGE_KEY)).toBe(before)
  })
})

describe('datos guardados dañados', () => {
  it.each(['{ roto', '{"schemaVersion": 1}', '"texto"'])(
    'con %s: lanza StorageCorruptedError y no sobrescribe',
    async (raw) => {
      storage.setItem(STORAGE_KEY, raw)

      await expect(repo.getData()).rejects.toThrow(StorageCorruptedError)
      await expect(repo.createCard(cardInput)).rejects.toThrow(
        StorageCorruptedError,
      )
      expect(storage.getItem(STORAGE_KEY)).toBe(raw)
    },
  )

  it('se puede recuperar importando un respaldo', async () => {
    storage.setItem(STORAGE_KEY, '{ roto')
    const backup = serializeBackup(sampleAppData(), '2026-10-23T00:00:00.000Z')

    expect(await repo.importBackup(backup)).toMatchObject({ ok: true })
    expect((await repo.getData()).cards).toHaveLength(1)
  })
})
