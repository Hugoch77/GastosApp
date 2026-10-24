import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { SyncNetworkError } from '../data/syncApi'
import type { SyncEngine } from '../data/syncEngine'
import { useGastosContext } from './gastosContext'
import { SyncContext, type SyncStatus } from './syncContext'

interface Props {
  engine: SyncEngine
  children: ReactNode
}

/** Espera tras un cambio local antes de subirlo (junta varios cambios seguidos). */
const PUSH_DELAY_MS = 3_000

function errorMessage(error: unknown): string {
  if (error instanceof SyncNetworkError) {
    return 'Sin conexión con el servidor; se sincronizará más tarde.'
  }
  return error instanceof Error ? error.message : 'No se pudo sincronizar.'
}

/**
 * Sincroniza en segundo plano, sin bloquear la pantalla:
 * - al abrir la app y al volver a ella,
 * - al recuperar la conexión,
 * - unos segundos después de cada cambio local.
 */
export function SyncProvider({ engine, children }: Props) {
  const { state, mutate } = useGastosContext()
  const [session, setSession] = useState(() => engine.session())
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  // Una sola sincronización a la vez; si llega otra petición, se repite al terminar.
  const running = useRef(false)
  const runAgain = useRef(false)

  const syncNow = useCallback(async () => {
    if (!engine.session()) return
    if (running.current) {
      runAgain.current = true
      return
    }
    running.current = true
    setStatus('syncing')
    try {
      do {
        runAgain.current = false
        await engine.sync(mutate)
      } while (runAgain.current)
      setStatus('idle')
      setError(null)
    } catch (caught) {
      setStatus('error')
      setError(errorMessage(caught))
    } finally {
      running.current = false
      setSession(engine.session())
    }
  }, [engine, mutate])

  const login = useCallback(
    async (email: string, password: string, deviceName: string) => {
      // Los errores de syncApi ya traen un mensaje para mostrar tal cual.
      await engine.login(email, password, deviceName)
      // La primera sincronización la dispara el efecto que vigila el token.
      setSession(engine.session())
      setError(null)
    },
    [engine],
  )

  const logout = useCallback(async () => {
    await engine.logout()
    setSession(null)
    setStatus('idle')
    setError(null)
  }, [engine])

  const logoutAll = useCallback(async () => {
    await engine.logoutAll()
    setSession(null)
    setStatus('idle')
    setError(null)
  }, [engine])

  const requestFullSync = useCallback(() => {
    engine.requestFullSync()
    setSession(engine.session())
    void syncNow()
  }, [engine, syncNow])

  const pendingChanges =
    state.status === 'ready' && session ? engine.pendingChanges(state.data) : 0

  // Al abrir la app con sesión y justo después de iniciar sesión. Con un timeout
  // que se cancela al desmontar: StrictMode monta dos veces y así solo se sincroniza una.
  const isReady = state.status === 'ready'
  const token = session?.token
  useEffect(() => {
    if (!isReady || !token) return
    const timeout = window.setTimeout(() => void syncNow(), 0)
    return () => window.clearTimeout(timeout)
  }, [isReady, token, syncNow])

  // Un rato después de cada cambio local.
  useEffect(() => {
    if (pendingChanges === 0 || status !== 'idle') return
    const timeout = window.setTimeout(() => void syncNow(), PUSH_DELAY_MS)
    return () => window.clearTimeout(timeout)
  }, [pendingChanges, status, syncNow])

  // Al volver a la app y al recuperar la conexión.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncNow()
    }
    const onOnline = () => void syncNow()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [syncNow])

  const value = useMemo(
    () => ({
      session,
      status,
      error,
      pendingChanges,
      login,
      logout,
      logoutAll,
      syncNow,
      requestFullSync,
    }),
    [
      session,
      status,
      error,
      pendingChanges,
      login,
      logout,
      logoutAll,
      syncNow,
      requestFullSync,
    ],
  )

  return <SyncContext value={value}>{children}</SyncContext>
}
