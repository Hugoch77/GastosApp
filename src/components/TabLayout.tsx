import { Link, NavLink, Outlet } from 'react-router'
import { ChartIcon, HomeIcon, ListIcon, PlusIcon, SettingsIcon } from './Icons'

const TABS = [
  { to: '/', label: 'Panel', icon: HomeIcon, testId: 'nav-dashboard' },
  {
    to: '/movimientos',
    label: 'Movimientos',
    icon: ListIcon,
    testId: 'nav-transactions',
  },
  {
    to: '/graficas',
    label: 'Gráficas',
    icon: ChartIcon,
    testId: 'nav-insights',
  },
  {
    to: '/ajustes',
    label: 'Ajustes',
    icon: SettingsIcon,
    testId: 'nav-settings',
  },
]

/** Pantallas principales: contenido + botón flotante "+" + barra de pestañas inferior. */
export function TabLayout() {
  return (
    <>
      <div className="pb-36">
        <Outlet />
      </div>

      <Link
        to="/movimientos/nuevo"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] flex size-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg active:bg-indigo-700"
        aria-label="Agregar movimiento"
        data-testid="add-transaction"
      >
        <PlusIcon className="size-7" />
      </Link>

      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <ul className="mx-auto flex max-w-md">
          {TABS.map(({ to, label, icon: TabIcon, testId }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={to === '/'}
                data-testid={testId}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                    isActive
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`
                }
              >
                <TabIcon />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
