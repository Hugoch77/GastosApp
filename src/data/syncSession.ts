/**
 * Sesión de sincronización de ESTE dispositivo. Se guarda en su propia clave de
 * LocalStorage: no forma parte de los datos ni de los respaldos.
 */
import { z } from 'zod'

export const SYNC_STORAGE_KEY = 'gastosapp-sync'

const SyncSessionSchema = z.object({
  token: z.string().min(1),
  email: z.string(),
  deviceName: z.string(),
  /** Última revisión recibida del servidor; 0 = falta la primera sincronización completa. */
  cursor: z.int().min(0),
  /** Cuándo empezó la última subida exitosa; null = subir todo. */
  lastPushedAt: z.iso.datetime().nullable(),
  /** Cuándo terminó la última sincronización exitosa. */
  lastSyncAt: z.iso.datetime().nullable(),
})

export type SyncSession = z.infer<typeof SyncSessionSchema>

/** null si no hay sesión o lo guardado no se puede leer. */
export function loadSyncSession(storage: Storage): SyncSession | null {
  const raw = storage.getItem(SYNC_STORAGE_KEY)
  if (raw === null) return null
  try {
    const result = SyncSessionSchema.safeParse(JSON.parse(raw))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function saveSyncSession(storage: Storage, session: SyncSession): void {
  storage.setItem(
    SYNC_STORAGE_KEY,
    JSON.stringify(SyncSessionSchema.parse(session)),
  )
}

export function clearSyncSession(storage: Storage): void {
  storage.removeItem(SYNC_STORAGE_KEY)
}
