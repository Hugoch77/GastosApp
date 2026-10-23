import { todayInMexico } from './lib/today'

// Pantalla provisional: la UI real llega en la fase 4.
function App() {
  return (
    <main className="mx-auto min-h-dvh max-w-md bg-slate-50 p-4 text-slate-900">
      <h1 className="text-2xl font-bold" data-testid="app-title">
        GastosApp
      </h1>
      <p className="mt-2 text-slate-600">
        En construcción · Hoy es{' '}
        <span data-testid="today">{todayInMexico()}</span>
      </p>
    </main>
  )
}

export default App
