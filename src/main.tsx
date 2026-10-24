import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import App from './App.tsx'
import { UpdatePrompt } from './components/UpdatePrompt'
import { LocalStorageRepository } from './data/localStorageRepository'
import { createSyncApi, DEFAULT_API_URL } from './data/syncApi'
import { SyncEngine } from './data/syncEngine'
import './index.css'
import { shareTargetRedirect } from './lib/shareTarget'
import { nowTimestamp } from './lib/today'
import { GastosProvider } from './state/GastosProvider'
import { SyncProvider } from './state/SyncProvider'

// Abierta desde "Compartir" de otra app: se pasa al formulario antes de montar React.
// replaceState cambia la URL sin recargar ni dejar una entrada extra en el historial.
const shareRedirect = shareTargetRedirect(new URL(window.location.href))
if (shareRedirect) window.history.replaceState(null, '', shareRedirect)

// HashRouter (/#/ruta) funciona en cualquier hosting estático sin configurar el servidor.
const repository = new LocalStorageRepository()

// Sincronización con la nube (api/). Para probar con la API local, crea
// `.env.local` con VITE_API_URL=http://localhost:8000
const apiUrl: string = import.meta.env.VITE_API_URL || DEFAULT_API_URL
const syncEngine = new SyncEngine({
  api: createSyncApi(apiUrl),
  storage: window.localStorage,
  now: () => nowTimestamp(),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <GastosProvider repository={repository}>
        <SyncProvider engine={syncEngine}>
          <App />
          <UpdatePrompt />
        </SyncProvider>
      </GastosProvider>
    </HashRouter>
  </StrictMode>,
)
