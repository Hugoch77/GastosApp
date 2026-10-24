import { describe, expect, it } from 'vitest'
import { emptyAppData } from './defaults'
import type { Category } from './schema'
import {
  changesSince,
  countChanges,
  mergeRemoteChanges,
  resetUntouchedDefaultCategories,
  UNTOUCHED_DEFAULT_TIMESTAMP,
  type SyncChanges,
} from './sync'
import { sampleAppData, sampleCard, sampleTransaction } from './testing'

const OCT_1 = '2026-10-01T12:00:00.000Z'
const OCT_2 = '2026-10-02T12:00:00.000Z'
const OCT_3 = '2026-10-03T12:00:00.000Z'

function remote(changes: Partial<SyncChanges>): SyncChanges {
  return { cards: [], categories: [], transactions: [], ...changes }
}

describe('changesSince', () => {
  const data = sampleAppData({
    transactions: [
      sampleTransaction({ id: 'old', updatedAt: OCT_1 }),
      sampleTransaction({ id: 'same-instant', updatedAt: OCT_2 }),
      sampleTransaction({ id: 'new', updatedAt: OCT_3 }),
    ],
  })

  it.each([
    [
      'desde una fecha incluye ese mismo instante',
      OCT_2,
      ['same-instant', 'new'],
    ],
    [
      'sin fecha (nunca ha subido) incluye todo',
      null,
      ['old', 'same-instant', 'new'],
    ],
    ['después de todo no hay nada', '2026-12-01T00:00:00.000Z', []],
  ])('%s', (_case, since, expectedIds) => {
    expect(changesSince(data, since).transactions.map((t) => t.id)).toEqual(
      expectedIds,
    )
  })

  it('revisa tarjetas, categorías y movimientos', () => {
    const changes = changesSince(data, null)
    expect(changes.cards).toHaveLength(1)
    expect(changes.categories).toHaveLength(data.categories.length)
    expect(countChanges(changes)).toBe(1 + data.categories.length + 3)
  })
})

describe('mergeRemoteChanges', () => {
  it.each([
    ['lo remoto más reciente gana', OCT_1, OCT_2, 'Remota'],
    ['lo remoto más viejo se ignora', OCT_2, OCT_1, 'Local'],
    ['con empate se queda lo local', OCT_1, OCT_1, 'Local'],
  ])('%s', (_case, localUpdatedAt, remoteUpdatedAt, expectedName) => {
    const data = sampleAppData({
      cards: [sampleCard({ name: 'Local', updatedAt: localUpdatedAt })],
    })
    const merged = mergeRemoteChanges(
      data,
      remote({
        cards: [sampleCard({ name: 'Remota', updatedAt: remoteUpdatedAt })],
      }),
    )
    expect(merged.cards.map((c) => c.name)).toEqual([expectedName])
  })

  it('agrega lo que no existía y conserva lo que solo está aquí', () => {
    const data = sampleAppData()
    const merged = mergeRemoteChanges(
      data,
      remote({ transactions: [sampleTransaction({ id: 'tx-remoto' })] }),
    )
    expect(merged.transactions.map((t) => t.id)).toEqual(['tx-1', 'tx-remoto'])
  })

  it('un borrado remoto más reciente borra lo local', () => {
    const merged = mergeRemoteChanges(
      sampleAppData(),
      remote({
        transactions: [
          sampleTransaction({ updatedAt: OCT_2, deletedAt: OCT_2 }),
        ],
      }),
    )
    expect(merged.transactions[0].deletedAt).toBe(OCT_2)
  })

  it('no toca la configuración propia del dispositivo', () => {
    const data = sampleAppData({
      settings: {
        activeCardId: 'card-1',
        extraHolidays: ['2026-10-01'],
        lastBackupAt: OCT_1,
      },
    })
    const merged = mergeRemoteChanges(
      data,
      remote({ cards: [sampleCard({ id: 'card-2' })] }),
    )
    expect(merged.settings).toEqual(data.settings)
  })

  it.each([
    [
      'la seleccionada se borró en otro dispositivo',
      'card-1',
      [
        sampleCard({ id: 'card-1', updatedAt: OCT_2, deletedAt: OCT_2 }),
        sampleCard({ id: 'card-2' }),
      ],
      'card-2',
    ],
    [
      'un dispositivo nuevo sin tarjetas recibe la primera',
      null,
      [sampleCard({ id: 'card-9' })],
      'card-9',
    ],
    [
      'ya no queda ninguna tarjeta activa',
      'card-1',
      [sampleCard({ id: 'card-1', updatedAt: OCT_2, deletedAt: OCT_2 })],
      null,
    ],
  ])(
    'tarjeta seleccionada: %s',
    (_case, activeCardId, remoteCards, expected) => {
      const data = {
        ...sampleAppData(),
        settings: { activeCardId, extraHolidays: [], lastBackupAt: null },
        cards: activeCardId ? [sampleCard()] : [],
        transactions: [],
      }
      const merged = mergeRemoteChanges(data, remote({ cards: remoteCards }))
      expect(merged.settings.activeCardId).toBe(expected)
    },
  )
})

describe('resetUntouchedDefaultCategories', () => {
  const NOW = '2026-10-24T18:00:00.000Z'

  function categoryById(categories: Category[], id: string) {
    return categories.find((c) => c.id === id)
  }

  it('las categorías por defecto sin cambios quedan con fecha 1970', () => {
    const result = resetUntouchedDefaultCategories(emptyAppData(NOW))
    expect(
      result.categories.every(
        (c) => c.updatedAt === UNTOUCHED_DEFAULT_TIMESTAMP,
      ),
    ).toBe(true)
  })

  it.each([
    ['renombrada', { name: 'Restaurantes' }],
    ['con otro ícono', { icon: '🌮' }],
    ['borrada', { deletedAt: NOW }],
  ])('una categoría %s conserva su fecha', (_case, change) => {
    const data = emptyAppData(NOW)
    data.categories = data.categories.map((c) =>
      c.id === 'food' ? { ...c, ...change } : c,
    )
    const result = resetUntouchedDefaultCategories(data)
    expect(categoryById(result.categories, 'food')?.updatedAt).toBe(NOW)
    expect(categoryById(result.categories, 'groceries')?.updatedAt).toBe(
      UNTOUCHED_DEFAULT_TIMESTAMP,
    )
  })

  it('las categorías creadas por el usuario no cambian', () => {
    const data = emptyAppData(NOW)
    data.categories.push({
      id: 'pets',
      name: 'Mascotas',
      icon: '🐶',
      updatedAt: NOW,
      deletedAt: null,
    })
    const result = resetUntouchedDefaultCategories(data)
    expect(categoryById(result.categories, 'pets')?.updatedAt).toBe(NOW)
  })

  it('una renombrada en otro dispositivo le gana a la que nadie tocó', () => {
    const otherDevice = remote({
      categories: [
        {
          id: 'food',
          name: 'Restaurantes',
          icon: '🍔',
          updatedAt: OCT_1,
          deletedAt: null,
        },
      ],
    })
    const thisDevice = resetUntouchedDefaultCategories(emptyAppData(NOW))
    const merged = mergeRemoteChanges(thisDevice, otherDevice)
    expect(categoryById(merged.categories, 'food')?.name).toBe('Restaurantes')
  })
})
