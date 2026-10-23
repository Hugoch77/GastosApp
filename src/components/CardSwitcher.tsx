import { activeCards } from '../data/selectors'
import { useSelectedCard } from '../hooks/useSelectedCard'
import { useGastos } from '../state/gastosContext'

/** Selector de tarjeta; solo aparece si hay más de una. */
export function CardSwitcher() {
  const { data, mutate } = useGastos()
  const { card } = useSelectedCard()
  const cards = activeCards(data)

  if (cards.length < 2) return null

  return (
    <select
      aria-label="Tarjeta"
      value={card.id}
      onChange={(e) =>
        void mutate((repo) =>
          repo.updateSettings({ activeCardId: e.target.value }),
        )
      }
      className="max-w-40 rounded-lg bg-slate-200 px-2 py-1.5 text-sm font-medium dark:bg-slate-800"
      data-testid="card-switcher"
    >
      {cards.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
}
