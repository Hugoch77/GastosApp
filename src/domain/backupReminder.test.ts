import { describe, expect, it } from 'vitest'
import { needsBackupReminder } from './backupReminder'

describe('needsBackupReminder', () => {
  it.each([
    // [hoy, último respaldo, primer cambio sin respaldar, ¿recordar?]
    ['2026-11-06', '2026-10-23', '2026-10-25', true], // 14 días desde el respaldo
    ['2026-11-05', '2026-10-23', '2026-10-25', false], // 13 días
    ['2026-12-01', '2026-10-23', null, false], // nada nuevo que respaldar
    ['2026-11-06', null, '2026-10-23', true], // nunca respaldó: cuenta desde el primer cambio
    ['2026-11-05', null, '2026-10-23', false],
    ['2026-10-23', null, null, false], // sin datos
  ])('hoy %s, respaldo %s, cambio %s → %s', (today, last, change, expected) => {
    expect(
      needsBackupReminder({
        today,
        lastBackupDate: last,
        firstUnsavedChangeDate: change,
      }),
    ).toBe(expected)
  })
})
