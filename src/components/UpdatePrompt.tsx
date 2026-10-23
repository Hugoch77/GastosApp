import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const OFFLINE_READY_VISIBLE_MS = 4000

/**
 * Avisos del service worker (PWA):
 * - la app ya funciona sin conexión (solo la primera vez);
 * - hay una versión nueva: se actualiza cuando el usuario lo decide.
 */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  // El aviso de "funciona sin conexión" es informativo: se oculta solo.
  // El de nueva versión se queda hasta que el usuario decida.
  useEffect(() => {
    if (!offlineReady) return
    const timer = window.setTimeout(
      () => setOfflineReady(false),
      OFFLINE_READY_VISIBLE_MS,
    )
    return () => window.clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  if (!offlineReady && !needRefresh) return null

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div
      role="status"
      data-testid="pwa-toast"
      className="fixed inset-x-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900 p-4 text-sm text-white shadow-lg dark:bg-slate-800"
    >
      <p className="flex-1">
        {needRefresh
          ? 'Hay una nueva versión disponible.'
          : 'Listo: la app ya funciona sin conexión.'}
      </p>
      {needRefresh && (
        <button
          type="button"
          onClick={() => void updateServiceWorker()}
          className="rounded-lg bg-indigo-500 px-3 py-1.5 font-semibold"
          data-testid="pwa-update"
        >
          Actualizar
        </button>
      )}
      <button
        type="button"
        onClick={close}
        className="rounded-lg px-2 py-1.5 text-slate-300"
        aria-label="Cerrar aviso"
      >
        ✕
      </button>
    </div>
  )
}
