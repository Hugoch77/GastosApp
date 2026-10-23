import { describe, expect, it } from 'vitest'
import { backupFileName, parseBackup, serializeBackup } from './backup'
import { sampleAppData } from './testing'

describe('serializeBackup / parseBackup', () => {
  it('ida y vuelta conserva los datos', () => {
    const data = sampleAppData()
    const json = serializeBackup(data, '2026-10-23T18:00:00.000Z')

    expect(JSON.parse(json).exportedAt).toBe('2026-10-23T18:00:00.000Z')
    expect(parseBackup(json)).toEqual({ ok: true, data })
  })

  it('JSON mal formado', () => {
    expect(parseBackup('{ no es json')).toEqual({
      ok: false,
      error: 'El archivo no es un JSON válido',
    })
  })

  it('versión más nueva que la app', () => {
    const result = parseBackup(
      JSON.stringify({ ...sampleAppData(), schemaVersion: 99 }),
    )
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(/versión más nueva/)
  })

  it('datos inválidos: el error indica dónde está el problema', () => {
    const data = sampleAppData()
    data.transactions[0].amountCents = -5
    const result = parseBackup(JSON.stringify(data))
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(
      /datos inválidos[\s\S]*amountCents/,
    )
  })
})

describe('backupFileName', () => {
  it('incluye la fecha', () => {
    expect(backupFileName('2026-10-23')).toBe(
      'gastosapp-respaldo-2026-10-23.json',
    )
  })
})
