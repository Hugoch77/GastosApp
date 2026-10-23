import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import App from './App.tsx'
import { UpdatePrompt } from './components/UpdatePrompt'
import { LocalStorageRepository } from './data/localStorageRepository'
import './index.css'
import { GastosProvider } from './state/GastosProvider'

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
