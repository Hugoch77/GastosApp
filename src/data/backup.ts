/**
 * Exportar e importar respaldos JSON.
 * Un respaldo es el mismo objeto que se guarda en LocalStorage más `exportedAt`.
 */
import { z } from 'zod'
import { migrateToCurrent, SchemaVersionError } from './migrations'
import type { AppData } from './schema'

export type ParseBackupResult =
  { ok: true; data: AppData } | { ok: false; error: string }

export function serializeBackup(data: AppData, exportedAt: string): string {
  return JSON.stringify({ ...data, exportedAt }, null, 2)
}

/** Nombre sugerido para el archivo: gastosapp-respaldo-2026-10-23.json */
export function backupFileName(today: string): string {
  return `gastosapp-respaldo-${today}.json`
}

/** Valida y migra un respaldo. Nunca lanza: regresa un error legible. */
export function parseBackup(json: string): ParseBackupResult {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido' }
  }

  try {
    // `exportedAt` no es parte del esquema; Zod descarta los campos desconocidos.
    return { ok: true, data: migrateToCurrent(raw) }
  } catch (error) {
    if (error instanceof SchemaVersionError) {
      return { ok: false, error: error.message }
    }
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        error: `El respaldo tiene datos inválidos:\n${z.prettifyError(error)}`,
      }
    }
    throw error
  }
}
