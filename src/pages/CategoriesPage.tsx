import { Link } from 'react-router'
import { PageHeader } from '../components/PageHeader'
import { ui } from '../components/styles'
import { activeCategories, transactionCountByCategory } from '../data/selectors'
import { useGastos } from '../state/gastosContext'

/** Ruta /categorias */
export function CategoriesPage() {
  const { data } = useGastos()
  const counts = transactionCountByCategory(data)

  return (
    <>
      <PageHeader title="Categorías" backTo="/ajustes" />
      <main className="space-y-4 px-4 pb-10">
        <ul className={ui.list}>
          {activeCategories(data).map((category) => {
            const count = counts.get(category.id) ?? 0
            return (
              <li key={category.id}>
                <Link
                  to={`/categorias/${category.id}`}
                  className="flex items-center gap-3 px-4 py-3 active:bg-slate-100 dark:active:bg-slate-800"
                  data-testid="category-row"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg dark:bg-slate-800">
                    {category.icon}
                  </span>
                  <span
                    className="flex-1 font-medium"
                    data-testid="category-name"
                  >
                    {category.name}
                  </span>
                  <span className={ui.muted}>
                    {count === 1 ? '1 movimiento' : `${count} movimientos`}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
        <Link
          to="/categorias/nueva"
          className={ui.buttonSecondary}
          data-testid="add-category"
        >
          Agregar categoría
        </Link>
      </main>
    </>
  )
}
