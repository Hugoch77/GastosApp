import { beforeEach, describe, expect, it } from 'vitest'
import { LocalStorageRepository } from './localStorageRepository'
import type { Card, Category, Transaction } from './schema'
import { countChanges, type SyncChanges } from './sync'
import {
  SyncAuthError,
  SyncNetworkError,
  type SyncApi,
  type SyncResult,
} from './syncApi'
import { SyncEngine } from './syncEngine'
import { loadSyncSession } from './syncSession'
import { createMemoryStorage, sequentialClock, sequentialIds } from './testing'

const PASSWORD = 'una contraseña larga'

type Kind = keyof SyncChanges
type StoredRecord = { record: Card | Category | Transaction; revision: number }

/** Servidor en memoria con las mismas reglas que api/app/sync.py. */
class FakeServer implements SyncApi {
  private readonly records: Record<Kind, Map<string, StoredRecord>> = {
    cards: new Map(),
    categories: new Map(),
    transactions: new Map(),
  }
  private revision = 0
  private readonly tokens = new Set<string>()
  /** Lo que subió cada sincronización, para revisar qué se mandó. */
  readonly pushes: SyncChanges[] = []
  offline = false

  async login(email: string, password: string): Promise<string> {
    if (password !== PASSWORD) {
      throw new SyncAuthError('Correo o contraseña incorrectos')
    }
    const token = `token-${email}-${this.tokens.size + 1}`
    this.tokens.add(token)
    return token
  }

  async logout(token: string): Promise<void> {
    this.checkConnection()
    this.tokens.delete(token)
  }

  async logoutAll(): Promise<void> {
    this.checkConnection()
    this.tokens.clear()
  }

  async sync(
    token: string,
    cursor: number,
    changes: SyncChanges,
  ): Promise<SyncResult> {
    this.checkConnection()
    if (!this.tokens.has(token)) throw new SyncAuthError('Inicia sesión')
    this.pushes.push(changes)

    let written: number | null = null
    for (const kind of ['cards', 'categories', 'transactions'] as const) {
      for (const record of changes[kind]) {
        const stored = this.records[kind].get(record.id)
        if (stored && record.updatedAt <= stored.record.updatedAt) continue
        written ??= ++this.revision
        this.records[kind].set(record.id, { record, revision: written })
      }
    }

    const changedSince = <T>(kind: Kind) =>
      [...this.records[kind].values()]
        .filter((s) => s.revision > cursor && s.revision !== written)
        .map((s) => s.record as T)
    const remote = {
      cards: changedSince<Card>('cards'),
      categories: changedSince<Category>('categories'),
      transactions: changedSince<Transaction>('transactions'),
    }
    const all = [...Object.values(this.records)].flatMap((m) => [...m.values()])
    const received = all
      .filter((s) => s.revision > cursor)
      .map((s) => s.revision)
    return {
      cursor: Math.max(cursor, written ?? 0, ...received),
      changes: remote,
    }
  }

  stored<K extends Kind>(kind: K, id: string) {
    return this.records[kind].get(id)?.record as
      SyncChanges[K][number] | undefined
  }

  private checkConnection() {
    if (this.offline) throw new SyncNetworkError('Sin conexión')
  }
}

/** Un dispositivo: sus propios datos y su propia sesión, con un reloj compartido. */
function createDevice(server: FakeServer, now: () => string, name: string) {
  const storage = createMemoryStorage()
  const repo = new LocalStorageRepository({
    storage,
    now,
    newId: sequentialIds(name),
  })
  const engine = new SyncEngine({ api: server, storage, now })
  return {
    repo,
    engine,
    sync: () => engine.sync((operation) => operation(repo)),
    login: () => engine.login('Yo@Correo.com', PASSWORD, name),
    data: () => repo.getData(),
  }
}

const CARD = {
  name: 'BBVA Platinum',
  cutDay: 5,
  cutDayInNextPeriod: true,
  dueDay: 25,
  paymentBufferDays: 2,
}

let server: FakeServer
let phone: ReturnType<typeof createDevice>
let computer: ReturnType<typeof createDevice>

beforeEach(() => {
  server = new FakeServer()
  const clock = sequentialClock()
  phone = createDevice(server, clock, 'celular')
  computer = createDevice(server, clock, 'computadora')
})

/** El celular tiene una tarjeta con un gasto y sube todo. */
async function phoneWithData() {
  const card = await phone.repo.createCard(CARD)
  const transaction = await phone.repo.createTransaction({
    cardId: card.id,
    date: '2026-10-20',
    description: 'Rappi',
    amountCents: 25000,
    type: 'charge',
    categoryId: 'food',
    installments: null,
  })
  await phone.login()
  await phone.sync()
  return { card, transaction }
}

describe('inicio de sesión', () => {
  it('guarda la sesión lista para la primera sincronización', async () => {
    await phone.login()
    expect(phone.engine.session()).toMatchObject({
      email: 'yo@correo.com',
      deviceName: 'celular',
      cursor: 0,
      lastPushedAt: null,
      lastSyncAt: null,
    })
  })

  it('con contraseña incorrecta no guarda nada', async () => {
    await expect(
      phone.engine.login('yo@correo.com', 'otra', 'celular'),
    ).rejects.toThrow('Correo o contraseña incorrectos')
    expect(phone.engine.session()).toBeNull()
  })

  it('sin sesión, sincronizar no hace nada', async () => {
    await phone.sync()
    expect(server.pushes).toHaveLength(0)
  })
})

describe('primera sincronización', () => {
  it('el primer dispositivo sube todos sus datos', async () => {
    const { card, transaction } = await phoneWithData()

    expect(server.stored('cards', card.id)).toEqual(card)
    expect(server.stored('transactions', transaction.id)).toEqual(transaction)
    const session = phone.engine.session()
    expect(session?.cursor).toBeGreaterThan(0)
    expect(session?.lastSyncAt).not.toBeNull()
  })

  it('un dispositivo nuevo recibe todo y selecciona la tarjeta', async () => {
    const { card, transaction } = await phoneWithData()

    await computer.login()
    await computer.sync()

    const data = await computer.data()
    expect(data.cards).toEqual([card])
    expect(data.transactions).toEqual([transaction])
    expect(data.settings.activeCardId).toBe(card.id)
  })

  it('las categorías por defecto del dispositivo nuevo no pisan las renombradas', async () => {
    await phone.repo.updateCategory('food', {
      name: 'Restaurantes',
      icon: '🍔',
    })
    await phoneWithData()

    // La computadora se instaló DESPUÉS del cambio: sus categorías son más nuevas.
    await computer.data()
    await computer.login()
    await computer.sync()

    const food = (await computer.data()).categories.find((c) => c.id === 'food')
    expect(food?.name).toBe('Restaurantes')
    expect(server.stored('categories', 'food')?.name).toBe('Restaurantes')
  })

  it('lo que solo existe en el dispositivo nuevo también se sube', async () => {
    await phoneWithData()
    const pcCard = await computer.repo.createCard({ ...CARD, name: 'Nu' })

    await computer.login()
    await computer.sync()

    expect(server.stored('cards', pcCard.id)?.name).toBe('Nu')
    expect((await computer.data()).cards).toHaveLength(2)
  })
})

describe('sincronizaciones siguientes', () => {
  it('solo sube lo que cambió desde la última vez', async () => {
    const { transaction } = await phoneWithData()
    await phone.repo.updateTransaction(transaction.id, {
      ...transaction,
      description: 'Rappi cena',
    })

    await phone.sync()

    const lastPush = server.pushes.at(-1)!
    expect(countChanges(lastPush)).toBe(1)
    expect(lastPush.transactions[0].description).toBe('Rappi cena')
  })

  it('sin cambios no sube nada', async () => {
    await phoneWithData()
    await phone.sync()
    expect(countChanges(server.pushes.at(-1)!)).toBe(0)
  })

  it('los cambios de un dispositivo llegan al otro, incluidos los borrados', async () => {
    const { transaction } = await phoneWithData()
    await computer.login()
    await computer.sync()

    await phone.repo.deleteTransaction(transaction.id)
    await phone.sync()
    await computer.sync()

    const [onComputer] = (await computer.data()).transactions
    expect(onComputer.deletedAt).not.toBeNull()
  })

  it('si los dos editan lo mismo, gana el cambio más reciente', async () => {
    const { transaction } = await phoneWithData()
    await computer.login()
    await computer.sync()

    await computer.repo.updateTransaction(transaction.id, {
      ...transaction,
      description: 'Desde la computadora',
    })
    await phone.repo.updateTransaction(transaction.id, {
      ...transaction,
      description: 'Desde el celular (después)',
    })
    await computer.sync()
    await phone.sync()
    await computer.sync()

    for (const device of [phone, computer]) {
      const [t] = (await device.data()).transactions
      expect(t.description).toBe('Desde el celular (después)')
    }
  })

  it('cuenta los cambios pendientes de subir', async () => {
    const { transaction } = await phoneWithData()
    expect(phone.engine.pendingChanges(await phone.data())).toBe(0)

    await phone.repo.deleteTransaction(transaction.id)
    expect(phone.engine.pendingChanges(await phone.data())).toBe(1)
  })

  it('pedir una sincronización completa vuelve a subir y bajar todo', async () => {
    await phoneWithData()
    phone.engine.requestFullSync()
    expect(phone.engine.session()).toMatchObject({
      cursor: 0,
      lastPushedAt: null,
    })

    await phone.sync()
    const data = await phone.data()
    expect(countChanges(server.pushes.at(-1)!)).toBe(
      data.cards.length + data.categories.length + data.transactions.length,
    )
  })
})

describe('errores y cierre de sesión', () => {
  it('sin conexión falla sin perder la sesión ni los cambios pendientes', async () => {
    const { transaction } = await phoneWithData()
    await phone.repo.deleteTransaction(transaction.id)

    server.offline = true
    await expect(phone.sync()).rejects.toBeInstanceOf(SyncNetworkError)
    expect(phone.engine.pendingChanges(await phone.data())).toBe(1)

    server.offline = false
    await phone.sync()
    expect(phone.engine.pendingChanges(await phone.data())).toBe(0)
  })

  it('si el servidor rechaza la sesión, se cierra aquí y los datos se quedan', async () => {
    await phoneWithData()
    await server.logoutAll()

    await expect(phone.sync()).rejects.toBeInstanceOf(SyncAuthError)
    expect(phone.engine.session()).toBeNull()
    expect((await phone.data()).cards).toHaveLength(1)
  })

  it('cerrar sesión borra el token aunque no haya internet', async () => {
    await phoneWithData()
    server.offline = true

    await phone.engine.logout()
    expect(phone.engine.session()).toBeNull()
    expect((await phone.data()).cards).toHaveLength(1)
  })

  it('cerrar sesión en todos los dispositivos invalida también el otro', async () => {
    await phoneWithData()
    await computer.login()
    await computer.sync()

    await phone.engine.logoutAll()
    expect(phone.engine.session()).toBeNull()
    await expect(computer.sync()).rejects.toBeInstanceOf(SyncAuthError)
  })

  it('una sesión guardada dañada se ignora', () => {
    const storage = createMemoryStorage({ 'gastosapp-sync': '{"token": 1' })
    expect(loadSyncSession(storage)).toBeNull()
  })
})
