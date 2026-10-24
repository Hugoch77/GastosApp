import { describe, expect, it } from 'vitest'
import {
  migrateToCurrent,
  SchemaVersionError,
  upgrade,
  type Migration,
} from './migrations'
import { sampleAppData } from './testing'

describe('upgrade', () => {
  // Cadena ficticia v1 → v2 → v3 para probar el mecanismo.
  const fakeMigrations: Record<number, Migration> = {
    1: (data) => ({ ...data, schemaVersion: 2, steps: ['1→2'] }),
    2: (data) => ({
      ...data,
      schemaVersion: 3,
      steps: [...(data.steps as string[]), '2→3'],
    }),
  }

  it('aplica las migraciones en orden', () => {
    expect(upgrade({ schemaVersion: 1 }, fakeMigrations, 3)).toEqual({
      schemaVersion: 3,
      steps: ['1→2', '2→3'],
    })
  })

  it('empieza desde la versión de los datos', () => {
    expect(upgrade({ schemaVersion: 2, steps: [] }, fakeMigrations, 3)).toEqual(
      {
        schemaVersion: 3,
        steps: ['2→3'],
      },
    )
  })

  it('no toca datos que ya están en la versión actual', () => {
    expect(upgrade({ schemaVersion: 3, a: 1 }, fakeMigrations, 3)).toEqual({
      schemaVersion: 3,
      a: 1,
    })
  })

  it('rechaza datos de una versión más nueva que la app', () => {
    expect(() => upgrade({ schemaVersion: 4 }, fakeMigrations, 3)).toThrow(
      /más nueva/,
    )
  })

  it('falla si falta una migración intermedia', () => {
    expect(() =>
      upgrade({ schemaVersion: 1 }, { 2: fakeMigrations[2] }, 3),
    ).toThrow(/v1 a v2/)
  })

  it.each([
    null,
    [],
    'texto',
    {},
    { schemaVersion: '1' },
    { schemaVersion: 0 },
  ])('rechaza %j', (raw) => {
    expect(() => upgrade(raw, fakeMigrations, 3)).toThrow(SchemaVersionError)
  })
})

describe('migrateToCurrent', () => {
  it('valida datos de la versión actual', () => {
    const data = sampleAppData()
    expect(migrateToCurrent(structuredClone(data))).toEqual(data)
  })

  it('v1 → actual: las tarjetas conservan la regla del día de corte y no hay respaldo previo', () => {
    // Respaldo real de v1: sin `cutDayInNextPeriod` ni `lastBackupAt`.
    const current = sampleAppData()
    const v1Card: Record<string, unknown> = { ...current.cards[0] }
    delete v1Card.cutDayInNextPeriod
    const v1 = {
      ...current,
      schemaVersion: 1,
      settings: { activeCardId: 'card-1', extraHolidays: [] },
      cards: [v1Card],
    }
    const migrated = migrateToCurrent(v1)
    expect(migrated.cards.map((c) => c.cutDayInNextPeriod)).toEqual([false])
    expect(migrated.settings.lastBackupAt).toBeNull()
    expect(migrated).toEqual(current)
  })

  it('v2 → v3: agrega lastBackupAt vacío', () => {
    const current = sampleAppData()
    const v2 = {
      ...current,
      schemaVersion: 2,
      settings: { activeCardId: 'card-1', extraHolidays: ['2030-10-01'] },
    }
    expect(migrateToCurrent(v2).settings).toEqual({
      activeCardId: 'card-1',
      extraHolidays: ['2030-10-01'],
      lastBackupAt: null,
    })
  })
})
