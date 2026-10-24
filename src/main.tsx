import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import App from './App.tsx'
import { UpdatePrompt } from './components/UpdatePrompt'
import { LocalStorageRepository } from './data/localStorageRepository'
import './index.css'
import { shareTargetRedirect } from './lib/shareTarget'
import { GastosProvider } from './state/GastosProvider'

// Abierta desde "Compartir" de otra app: se pasa al formulario antes de montar React.
// replaceState cambia la URL sin recargar ni dejar una entrada extra en el historial.
const shareRedirect = shareTargetRedirect(new URL(window.location.href))
if (shareRedirect) window.history.replaceState(null, '', shareRedirect)

// HashRouter (/#/ruta) funciona en cualquier hosting estático sin configurar el servidor.
const repository = new LocalStorageRepository()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <GastosProvider repository={repository}>
        <App />
        <UpdatePrompt />
      </GastosProvider>
    </HashRouter>
  </StrictMode>,
)
