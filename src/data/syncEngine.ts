/**
 * Orquesta la sincronización de este dispositivo: inicio de sesión, subir los
 * cambios locales, aplicar los remotos y recordar hasta dónde se sincronizó.
 *
 * No depende de React; `SyncProvider` decide CUÁNDO llamar a `sync()`.
 */
import type { GastosRepository } from './repository'
import { changesSince, countChanges } from './sync'
import { SyncAuthError, type SyncApi } from './syncApi'
import {
  clearSyncSession,
  loadSyncSession,
  saveSyncSession,
  type SyncSession,
} from './syncSession'
import type { AppData } from './schema'

/** Ejecuta una operación sobre los datos (en la app: `mutate`, que además refresca la UI). */
export type RunOnRepository = <T>(
  operation: (repo: GastosRepository) => Promise<T>,
) => Promise<T>

export interface SyncEngineDeps {
  api: SyncApi
  /** Donde se guarda la sesión del dispositivo (LocalStorage en la app). */
  storage: Storage
  now: () => string
}

export class SyncEngine {
  private readonly deps: SyncEngineDeps

  constructor(deps: SyncEngineDeps) {
    this.deps = deps
  }

  session(): SyncSession | null {
    return loadSyncSession(this.deps.storage)
  }

  /** Cambios locales que aún no se suben (0 sin sesión). */
  pendingChanges(data: AppData): number {
    const session = this.session()
    if (!session) return 0
    return countChanges(changesSince(data, session.lastPushedAt))
  }

  /** Inicia sesión y deja todo listo para una sincronización completa. */
  async login(
    email: string,
    password: string,
    deviceName: string,
  ): Promise<void> {
    const token = await this.deps.api.login(email, password, deviceName)
    saveSyncSession(this.deps.storage, {
      token,
      email: email.trim().toLowerCase(),
      deviceName,
      cursor: 0,
      lastPushedAt: null,
      lastSyncAt: null,
    })
  }

  /** Cierra la sesión de este dispositivo. Los datos locales se conservan. */
  async logout(): Promise<void> {
    const session = this.session()
    clearSyncSession(this.deps.storage)
    if (session) {
      // Si no hay internet da igual: el token ya no está en el dispositivo.
      await this.deps.api.logout(session.token).catch(() => undefined)
    }
  }

  /** Cierra la sesión en todos los dispositivos (requiere conexión). */
  async logoutAll(): Promise<void> {
    const session = this.session()
    if (session) await this.deps.api.logoutAll(session.token)
    clearSyncSession(this.deps.storage)
  }

  /**
   * La próxima sincronización será completa: sube todo y baja todo.
   * Se usa cuando los datos locales se reemplazaron (importar respaldo, borrar todo).
   */
  requestFullSync(): void {
    const session = this.session()
    if (session) {
      saveSyncSession(this.deps.storage, {
        ...session,
        cursor: 0,
        lastPushedAt: null,
      })
    }
  }

  /**
   * Sube lo local, aplica lo remoto y guarda el nuevo cursor.
   * Si el servidor dice que la sesión ya no vale (401), se cierra aquí también.
   */
  async sync(run: RunOnRepository): Promise<void> {
    const session = this.session()
    if (!session) return

    const isFirstSync = session.cursor === 0
    if (isFirstSync) await run((repo) => repo.resetUntouchedDefaultCategories())

    // Se toma la hora ANTES de leer: lo que cambie durante la petición tendrá una
    // fecha igual o posterior y se subirá la próxima vez.
    const startedAt = this.deps.now()
    const data = await run((repo) => repo.getData())
    const changes = changesSince(
      data,
      isFirstSync ? null : session.lastPushedAt,
    )

    let result
    try {
      result = await this.deps.api.sync(session.token, session.cursor, changes)
    } catch (error) {
      if (error instanceof SyncAuthError) clearSyncSession(this.deps.storage)
      throw error
    }

    if (countChanges(result.changes) > 0) {
      await run((repo) => repo.applyRemoteChanges(result.changes))
    }

    // Si mientras tanto se cerró la sesión (o se pidió una completa), no se pisa.
    const current = this.session()
    if (current?.token !== session.token || current.cursor !== session.cursor) {
      return
    }
    saveSyncSession(this.deps.storage, {
      ...current,
      cursor: result.cursor,
      lastPushedAt: startedAt,
      lastSyncAt: this.deps.now(),
    })
  }
}
