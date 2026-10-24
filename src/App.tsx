import { Navigate, Route, Routes } from 'react-router'
import { TabLayout } from './components/TabLayout'
import { activeCards } from './data/selectors'
import { CardFormPage } from './pages/CardFormPage'
import { CardsOverviewPage } from './pages/CardsOverviewPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { CategoryFormPage } from './pages/CategoryFormPage'
import { DashboardPage } from './pages/DashboardPage'
import { InsightsPage } from './pages/InsightsPage'
import { InstallmentsPage } from './pages/InstallmentsPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { SettingsPage } from './pages/SettingsPage'
import { StorageErrorPage } from './pages/StorageErrorPage'
import { TransactionFormPage } from './pages/TransactionFormPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { useGastosContext } from './state/gastosContext'

function App() {
  const { state } = useGastosContext()

  if (state.status === 'loading') return null
  if (state.status === 'corrupted')
    return <StorageErrorPage message={state.message} />
  if (activeCards(state.data).length === 0) return <OnboardingPage />

  return (
    <div className="mx-auto max-w-md">
      <Routes>
        {/* Pantallas principales con barra de pestañas */}
        <Route element={<TabLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="movimientos" element={<TransactionsPage />} />
          <Route path="graficas" element={<InsightsPage />} />
          <Route path="ajustes" element={<SettingsPage />} />
        </Route>

        {/* Formularios a pantalla completa */}
        <Route path="movimientos/nuevo" element={<TransactionFormPage />} />
        <Route path="movimientos/:id" element={<TransactionFormPage />} />
        <Route path="tarjetas" element={<CardsOverviewPage />} />
        <Route path="tarjetas/nueva" element={<CardFormPage />} />
        <Route path="tarjetas/:id" element={<CardFormPage />} />
        <Route path="msi" element={<InstallmentsPage />} />
        <Route path="categorias" element={<CategoriesPage />} />
        <Route path="categorias/nueva" element={<CategoryFormPage />} />
        <Route path="categorias/:id" element={<CategoryFormPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
