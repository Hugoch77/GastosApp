/**
 * Context de la sincronización con la nube. El provider vive en SyncProvider.tsx.
 */
import { createContext, useContext } from 'react'
import type { SyncSession } from '../data/syncSession'

export type SyncStatus = 'idle' | 'syncing' | 'error'

export interface SyncContextValue {
  /** null = este dispositivo no ha iniciado sesión */
  session: SyncSession | null
  status: SyncStatus
  /** Mensaje del último error (también si la sesión expiró) */
  error: string | null
  /** Cambios locales que aún no se suben */
  pendingChanges: number
  /** Lanza un error con mensaje legible si no se pudo iniciar sesión. */
  login: (email: string, password: string, deviceName: string) => Promise<void>
  logout: () => Promise<void>
  /** Lanza un error si no hay conexión. */
  logoutAll: () => Promise<void>
  syncNow: () => Promise<void>
  /** Tras reemplazar los datos locales: sube y baja todo de nuevo. */
  requestFullSync: () => void
}

export const SyncContext = createContext<SyncContextValue | null>(null)

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext)
  if (!value) {
    throw new Error('useSync debe usarse dentro de <SyncProvider>')
  }
  return value
}
